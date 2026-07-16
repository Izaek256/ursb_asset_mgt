"""Asset routes: bulk import from CSV/XLSX."""

import csv
import io
import uuid
import json
import asyncio
from datetime import datetime, date
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db, SessionLocal
from app.models.asset import Asset, AssetCondition, AssetStatus, AssetType, SourceType
from app.models.audit_log import AuditLog
from app.models.user import UserRole
from app.api.v1.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/assets", tags=["assets", "import"])

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

def _parse_csv(file_bytes: bytes) -> List[Dict[str, str]]:
    content = file_bytes.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(content))
    return list(reader)

def _parse_xlsx(file_bytes: bytes) -> List[Dict[str, Any]]:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    
    headers = [str(h).strip() if h else "" for h in rows[0]]
    data = []
    for row in rows[1:]:
        # If the entire row is empty, skip it
        if all(cell is None or str(cell).strip() == "" for cell in row):
            continue
        row_dict = {headers[i]: (str(cell).strip() if cell is not None else "") for i, cell in enumerate(row) if i < len(headers)}
        data.append(row_dict)
    return data

@router.post("/import")
async def bulk_import_assets(
    request: Request,
    file: UploadFile = File(...),
    import_mode: str = Form("add"),
    current_user=Depends(require_role(UserRole.ASSET_MANAGER, UserRole.SYSTEM_ADMINISTRATOR, UserRole.SUPER_SYSTEM_ADMINISTRATOR, UserRole.ASSET_CUSTODIAN))
):
    """
    Bulk import assets from a CSV or XLSX file.
    
    Modes:
    - add: inserts new assets.
    - update: updates existing unassigned assets matching serial_number.
    """
    if import_mode not in ("add", "update"):
        raise HTTPException(status_code=400, detail="Invalid import_mode. Must be 'add' or 'update'.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
        
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith('.csv') or filename_lower.endswith('.xlsx')):
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file type. Please upload a CSV or XLSX file."
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    try:
        if filename_lower.endswith('.csv'):
            rows = _parse_csv(file_bytes)
        else:
            rows = _parse_xlsx(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    total_rows = len(rows)

    async def event_generator():
        db = SessionLocal()
        try:
            imported = 0
            skipped = 0
            errors = []

            # Yield start event
            yield json.dumps({"type": "start", "total_rows": total_rows}) + "\n"
            await asyncio.sleep(0.01)

            # Get all existing serial numbers to avoid database roundtrips per row
            existing_assets_query = db.query(Asset)
            if import_mode == "update":
                serial_numbers_in_csv = [row.get("serial_number", "").strip() for row in rows if row.get("serial_number", "")]
                existing_assets = existing_assets_query.filter(Asset.serial_number.in_(serial_numbers_in_csv)).all()
                existing_assets_map = {a.serial_number: a for a in existing_assets}
                existing_serials = set(existing_assets_map.keys())
            else:
                existing_serials = {s[0] for s in db.query(Asset.serial_number).all()}
                existing_assets_map = {}
            
            assets_to_insert = []
            
            for idx, row in enumerate(rows, start=1):
                # Detect client disconnect to cancel and rollback transaction
                if await request.is_disconnected():
                    print("Client disconnected, rolling back batch import/update.")
                    db.rollback()
                    db.close()
                    return

                asset_name = row.get("asset_name", "").strip()
                asset_type_str = row.get("asset_type", "").strip()
                category = row.get("category", "").strip()
                serial_number = row.get("serial_number", "").strip()
                condition_str = row.get("condition", "").strip()
                source_type_str = row.get("source_type", "").strip()
                procurement_ref = row.get("procurement_ref", "").strip()
                cost_str = str(row.get("cost", "")).strip()
                acquisition_date_str = str(row.get("acquisition_date", "")).strip()
                supplier = row.get("supplier", "").strip()
                department = row.get("department", "").strip()
                
                # Base validation common to both
                if not serial_number:
                    skipped += 1
                    errors.append({"row": idx, "serial_number": None, "reason": "Missing or empty serial_number"})
                    yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                    await asyncio.sleep(0.005)
                    continue

                if import_mode == "update":
                    if serial_number not in existing_assets_map:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number, "reason": "Asset not found"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                        
                    asset_to_update = existing_assets_map[serial_number]
                    if asset_to_update.status != AssetStatus.AVAILABLE:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number, "reason": f"Asset is not available (Status: {asset_to_update.status.value})"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                    
                    # Apply updates for provided fields
                    if asset_name:
                        asset_to_update.asset_name = asset_name
                    if category:
                        asset_to_update.category = category
                    if supplier:
                        asset_to_update.supplier = supplier
                    if department:
                        asset_to_update.department = department
                    if procurement_ref:
                        asset_to_update.procurement_ref = procurement_ref
                        
                    if asset_type_str:
                        try:
                            asset_to_update.asset_type = AssetType(asset_type_str)
                        except ValueError:
                            skipped += 1
                            errors.append({"row": idx, "serial_number": serial_number, "reason": f"Invalid asset_type '{asset_type_str}'"})
                            yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                            await asyncio.sleep(0.005)
                            continue
                            
                    if condition_str:
                        try:
                            asset_to_update.condition = AssetCondition(condition_str)
                        except ValueError:
                            skipped += 1
                            errors.append({"row": idx, "serial_number": serial_number, "reason": f"Invalid condition '{condition_str}'"})
                            yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                            await asyncio.sleep(0.005)
                            continue
                            
                    if source_type_str:
                        try:
                            asset_to_update.source_type = SourceType(source_type_str)
                        except ValueError:
                            skipped += 1
                            errors.append({"row": idx, "serial_number": serial_number, "reason": f"Invalid source_type '{source_type_str}'"})
                            yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                            await asyncio.sleep(0.005)
                            continue
                            
                    if acquisition_date_str:
                        try:
                            if isinstance(row.get("acquisition_date"), datetime):
                                acq_date = row.get("acquisition_date").date()
                            else:
                                acq_date = datetime.strptime(acquisition_date_str, "%Y-%m-%d").date()
                            
                            if acq_date > date.today():
                                skipped += 1
                                errors.append({"row": idx, "serial_number": serial_number, "reason": "acquisition_date cannot be in the future"})
                                yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                                await asyncio.sleep(0.005)
                                continue
                            asset_to_update.acquisition_date = acq_date
                        except ValueError:
                            skipped += 1
                            errors.append({"row": idx, "serial_number": serial_number, "reason": "Invalid acquisition_date format (expected YYYY-MM-DD)"})
                            yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                            await asyncio.sleep(0.005)
                            continue
                            
                    if cost_str:
                        try:
                            if isinstance(row.get("cost"), (int, float)):
                                cost_int = int(row.get("cost"))
                            else:
                                cost_int = int(cost_str)
                            if cost_int < 0:
                                skipped += 1
                                errors.append({"row": idx, "serial_number": serial_number, "reason": "cost cannot be negative"})
                                yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                                await asyncio.sleep(0.005)
                                continue
                            asset_to_update.cost = cost_int
                        except ValueError:
                            skipped += 1
                            errors.append({"row": idx, "serial_number": serial_number, "reason": "cost must be an integer"})
                            yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                            await asyncio.sleep(0.005)
                            continue
                    
                    asset_to_update.updated_at = datetime.now()
                    imported += 1
                
                else: # import_mode == "add"
                    # 1. asset_name is present and non-empty
                    if not asset_name:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number or None, "reason": "Missing or empty asset_name"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                        
                    # 2. asset_type is a valid enum value
                    try:
                        asset_type_enum = AssetType(asset_type_str)
                    except ValueError:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number or None, "reason": f"Invalid asset_type '{asset_type_str}'"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                        
                    # 4. serial_number does not already exist in the assets table
                    if serial_number in existing_serials:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number, "reason": "serial_number already exists"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                        
                    # 5. condition is a valid enum value
                    try:
                        condition_enum = AssetCondition(condition_str)
                    except ValueError:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number, "reason": f"Invalid condition '{condition_str}'"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                        
                    # 6. source_type is a valid enum value
                    try:
                        source_type_enum = SourceType(source_type_str)
                    except ValueError:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number, "reason": f"Invalid source_type '{source_type_str}'"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                        
                    # 7. acquisition_date is a valid date in YYYY-MM-DD format and is not in the future
                    try:
                        # handle cases where excel reads it as datetime already
                        if isinstance(row.get("acquisition_date"), datetime):
                            acq_date = row.get("acquisition_date").date()
                        else:
                            acq_date = datetime.strptime(acquisition_date_str, "%Y-%m-%d").date()
                        
                        if acq_date > date.today():
                            skipped += 1
                            errors.append({"row": idx, "serial_number": serial_number, "reason": "acquisition_date cannot be in the future"})
                            yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                            await asyncio.sleep(0.005)
                            continue
                    except ValueError:
                        skipped += 1
                        errors.append({"row": idx, "serial_number": serial_number, "reason": "Invalid acquisition_date format (expected YYYY-MM-DD)"})
                        yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                        await asyncio.sleep(0.005)
                        continue
                        
                    # 8. cost is a non-negative integer (if provided)
                    cost_val = 0
                    if cost_str:
                        try:
                            # If parsed as float in excel
                            if isinstance(row.get("cost"), (int, float)):
                                cost_int = int(row.get("cost"))
                            else:
                                cost_int = int(cost_str)
                            if cost_int < 0:
                                skipped += 1
                                errors.append({"row": idx, "serial_number": serial_number, "reason": "cost cannot be negative"})
                                yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                                await asyncio.sleep(0.005)
                                continue
                            cost_val = cost_int
                        except ValueError:
                            skipped += 1
                            errors.append({"row": idx, "serial_number": serial_number, "reason": "cost must be an integer"})
                            yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                            await asyncio.sleep(0.005)
                            continue

                    # If it passed all validations, generate id and queue for insert
                    new_asset_id = f"AST-{uuid.uuid4().hex[:8].upper()}"
                    
                    asset = Asset(
                        asset_id=new_asset_id,
                        asset_name=asset_name,
                        asset_type=asset_type_enum,
                        category=category,
                        serial_number=serial_number,
                        condition=condition_enum,
                        status=AssetStatus.AVAILABLE,
                        is_active=True,
                        source_type=source_type_enum,
                        procurement_ref=procurement_ref or None,
                        cost=cost_val,
                        acquisition_date=acq_date,
                        supplier=supplier,
                        department=department or None,
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    assets_to_insert.append(asset)
                    
                    # Add to existing serials to prevent duplicates within the file itself
                    existing_serials.add(serial_number)
                    imported += 1

                # Yield progress updates per row for real-time visualization
                yield json.dumps({"type": "progress", "current": idx, "total": total_rows}) + "\n"
                await asyncio.sleep(0.005)

            if assets_to_insert:
                db.bulk_save_objects(assets_to_insert)
            
            # Commit the session transaction
            action_desc = "ASSET_BULK_IMPORT" if import_mode == "add" else "ASSET_BULK_UPDATE"
            details_desc = f"Bulk {import_mode}ed {imported} assets from file {file.filename}"
            
            audit_entry = AuditLog(
                user_id=current_user.id,
                action=action_desc,
                table_affected="assets",
                record_id="MULTIPLE",
                details=details_desc,
            )
            db.add(audit_entry)
            db.commit()

            # Yield final summary report
            yield json.dumps({
                "type": "summary",
                "total_rows": total_rows,
                "imported": imported,
                "skipped": skipped,
                "errors": errors
            }) + "\n"

        except Exception as e:
            db.rollback()
            yield json.dumps({"type": "error", "detail": f"Database transaction failed: {str(e)}"}) + "\n"
        finally:
            db.close()

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

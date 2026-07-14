"""Notification workflow endpoints."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.v1.auth import get_current_user
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    notification_id: str
    user_id: str
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
    related_asset_id: Optional[str] = None

    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    count: int


@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the current user's notifications, unread first, up to a limit of 50.

    Allowed Roles:
        All logged-in roles (System Administrator, Asset Manager, Asset Custodian, Employee).

    Data Scope:
        Operates on current user's data only (filtered by current_user.id).
    """
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == str(current_user.id))
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return notifications


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the count of unread notifications for the current user.

    Allowed Roles:
        All logged-in roles (System Administrator, Asset Manager, Asset Custodian, Employee).

    Data Scope:
        Operates on current user's data only (filtered by current_user.id).
    """
    count = (
        db.query(Notification)
        .filter(Notification.user_id == str(current_user.id), Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.patch("/{id}/read", response_model=NotificationResponse)
def mark_as_read(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marks a single notification as read.

    Allowed Roles:
        All logged-in roles.

    Data Scope:
        Operates on current user's data only. Raises a 403 Forbidden error
        if the notification does not belong to the current user.
    """
    notification = db.query(Notification).filter(Notification.notification_id == id).first()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    if notification.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this notification."
        )

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.patch("/read-all", response_model=dict)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marks all of the current user's notifications as read.

    Allowed Roles:
        All logged-in roles (System Administrator, Asset Manager, Asset Custodian, Employee).

    Data Scope:
        Operates on current user's data only (updates notifications filtered by current_user.id).
    """
    db.query(Notification).filter(
        Notification.user_id == str(current_user.id),
        Notification.is_read == False
    ).update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}

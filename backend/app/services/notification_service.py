"""Service layer for creating system in-app notifications with silent-failure design."""

import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

def create_notification(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    notification_type: str,
    related_asset_id: Optional[str] = None
) -> None:
    """
    Creates one or more notifications for a single recipient or a target role.

    Silent-Failure Design:
        A notification failure must never roll back or disrupt the main transaction
        that triggered it. This function wraps the write in its own try/except block,
        logs any errors, and never re-raises them.

    Parameters:
        db (Session): Database session.
        user_id (str): Recipient user ID (e.g. "5") or a role-targeted string (e.g. "Asset Manager").
        title (str): Title of the notification.
        message (str): Text message of the notification.
        notification_type (str): Categorical type (e.g. 'ASSIGNMENT_SENT', 'REQUEST_APPROVED').
        related_asset_id (str, optional): ID of the related asset, if any.
    """
    try:
        # Check if user_id is a role name (either matching enum values or string comparison)
        is_role = False
        try:
            role_values = [r.value for r in UserRole]
            if user_id in role_values:
                is_role = True
        except Exception:
            pass

        # Use a nested transaction (savepoint) to isolate notification database failures
        with db.begin_nested():
            if is_role:
                # Query active users having the given role
                recipients = db.query(User).filter(User.role == user_id, User.is_active == True).all()
                for recipient in recipients:
                    notification = Notification(
                        user_id=str(recipient.id),
                        title=title,
                        message=message,
                        notification_type=notification_type,
                        related_asset_id=related_asset_id,
                        is_read=False
                    )
                    db.add(notification)
            else:
                # Target single user recipient
                notification = Notification(
                    user_id=str(user_id),
                    title=title,
                    message=message,
                    notification_type=notification_type,
                    related_asset_id=related_asset_id,
                    is_read=False
                )
                db.add(notification)
            # The context manager automatically commits or rolls back the nested transaction savepoint.
    except Exception as e:
        logger.error(f"Notification creation failed (silently caught): {e}", exc_info=True)

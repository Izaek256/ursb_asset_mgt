from fastapi import Depends, HTTPException, Request, status

from app.models.user import User, UserRole


def get_current_user(request: Request) -> User:
    """Extract the authenticated user from request state (set by AuthMiddleware)."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


def require_role(role: UserRole):
    """Return a FastAPI dependency that enforces a specific user role."""

    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return _check

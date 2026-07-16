"""User-related service helpers.

Shared utilities for user management (password generation, etc.).
"""
import secrets
import string


def generate_secure_password(length: int = 12) -> str:
    """Generate a cryptographically secure password.

    Requirements:
    - Minimum 12 characters (default)
    - Includes uppercase, lowercase, digits, and special characters
    """
    if length < 12:
        length = 12

    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*"

    # Ensure at least one character from each required set
    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    # Fill the rest with random characters from all sets
    all_chars = uppercase + lowercase + digits + special
    for _ in range(length - len(password)):
        password.append(secrets.choice(all_chars))

    # Shuffle to avoid predictable pattern
    secrets.SystemRandom().shuffle(password)

    return ''.join(password)

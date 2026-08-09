import sqlite3

try:
    conn = sqlite3.connect('ursb_asset.db')
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS _alembic_tmp_users;")
    conn.commit()
    print("Dropped _alembic_tmp_users table.")
    conn.close()
except Exception as e:
    print(e)

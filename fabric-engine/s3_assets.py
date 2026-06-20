import mimetypes
import os
import sys
from pathlib import Path

VENDOR_DIR = Path(__file__).resolve().parent / ".vendor"
if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - env vars still work without dotenv
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv(Path(__file__).resolve().parent / ".env")

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:  # pragma: no cover - local fallback when boto3 is absent
    boto3 = None
    BotoCoreError = ClientError = Exception


S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "erdalguda-assets")
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION", "eu-north-1")
S3_PUBLIC_BASE_URL = os.getenv(
    "S3_PUBLIC_BASE_URL",
    f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com",
)
S3_UPLOAD_ENABLED = os.getenv("S3_UPLOAD_ENABLED", "true").lower() not in {
    "0",
    "false",
    "no",
}


def public_url(key: str) -> str:
    return f"{S3_PUBLIC_BASE_URL.rstrip('/')}/{key.lstrip('/')}"


def _client():
    if not S3_UPLOAD_ENABLED:
        return None
    if boto3 is None:
        print("[s3] boto3 is not installed; skipping S3 upload.")
        return None
    return boto3.client("s3", region_name=AWS_REGION)


def upload_file(local_path: Path, key: str) -> str | None:
    if not local_path.exists():
        print(f"[s3] missing local file, skipping: {local_path}")
        return None

    client = _client()
    if client is None:
        return None

    content_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
    try:
        client.upload_file(
            str(local_path),
            S3_BUCKET_NAME,
            key,
            ExtraArgs={
                "ContentType": content_type,
                "CacheControl": "public, max-age=31536000, immutable",
            },
        )
        url = public_url(key)
        print(f"[s3] uploaded {local_path} -> {url}")
        return url
    except (BotoCoreError, ClientError) as exc:
        print(f"[s3] upload failed for {local_path}: {exc}")
        return None


def upload_generated_tree(garment: str, fabric_id: str, generated_dir: Path) -> int:
    if not generated_dir.exists():
        print(f"[s3] generated dir missing, skipping: {generated_dir}")
        return 0

    uploaded = 0
    for path in generated_dir.rglob("*.png"):
        rel_path = path.relative_to(generated_dir).as_posix()
        key = f"{garment}/generated/{fabric_id}/{rel_path}"
        if upload_file(path, key):
            uploaded += 1
    print(f"[s3] {garment}/{fabric_id}: uploaded {uploaded} generated PNGs")
    return uploaded


def upload_swatch(garment: str, fabric_id: str, swatch_path: Path) -> str | None:
    return upload_file(swatch_path, f"{garment}/generated-swatches/{fabric_id}.png")


def delete_prefix(prefix: str) -> int:
    client = _client()
    if client is None:
        return 0

    deleted = 0
    paginator = client.get_paginator("list_objects_v2")
    try:
        for page in paginator.paginate(Bucket=S3_BUCKET_NAME, Prefix=prefix):
            objects = [{"Key": item["Key"]} for item in page.get("Contents", [])]
            if not objects:
                continue
            client.delete_objects(Bucket=S3_BUCKET_NAME, Delete={"Objects": objects})
            deleted += len(objects)
    except (BotoCoreError, ClientError) as exc:
        print(f"[s3] delete failed for prefix {prefix}: {exc}")
        return deleted

    if deleted:
        print(f"[s3] deleted {deleted} objects under {prefix}")
    return deleted


def delete_fabric_assets(garments: list[str], fabric_id: str) -> int:
    deleted = 0
    for garment in garments:
        deleted += delete_prefix(f"{garment}/generated/{fabric_id}/")
        delete_prefix(f"{garment}/generated-swatches/{fabric_id}.png")
    return deleted

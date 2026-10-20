from starlette.responses import JSONResponse


MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024


class MaxRequestBodySizeMiddleware:
    """Buffer request JSON only up to a small cap before FastAPI parses it."""

    def __init__(self, app, max_bytes: int = MAX_REQUEST_BODY_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        content_length = next(
            (value for key, value in scope.get("headers", []) if key.lower() == b"content-length"),
            None,
        )
        if content_length is not None:
            try:
                if int(content_length) > self.max_bytes:
                    await JSONResponse(
                        status_code=413,
                        content={"detail": f"Request body exceeds the {self.max_bytes // (1024 * 1024)} MiB limit."},
                    )(scope, receive, send)
                    return
            except ValueError:
                pass

        chunks: list[bytes] = []
        total = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue
            chunk = message.get("body", b"")
            total += len(chunk)
            if total > self.max_bytes:
                await JSONResponse(
                    status_code=413,
                    content={"detail": f"Request body exceeds the {self.max_bytes // (1024 * 1024)} MiB limit."},
                )(scope, receive, send)
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break

        body = b"".join(chunks)
        delivered = False

        async def replay_body():
            nonlocal delivered
            if delivered:
                return {"type": "http.request", "body": b"", "more_body": False}
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, replay_body, send)

CREATE TABLE IF NOT EXISTS message_handlers (
    id UUID,
    handler_name VARCHAR(100),
    UNIQUE(id, handler_name)
)
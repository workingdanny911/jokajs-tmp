# make sure we can truncate the messages table during testing

ALTER SCHEMA message_store OWNER TO message_store;
ALTER DEFAULT PRIVILEGES IN SCHEMA message_store GRANT UPDATE, INSERT, SELECT, DELETE ON TABLES TO message_store;

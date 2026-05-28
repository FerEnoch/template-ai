-- POC sentinel user — temporary until auth module is implemented.
-- Services hardcode userId=0; this seed ensures the FK references resolve
-- and RLS policies pass (app.current_user_id IS NOT NULL).

SET LOCAL app.current_user_id = '0';

INSERT INTO users (id, email, display_name, external_subject)
OVERRIDING SYSTEM VALUE
VALUES (0, 'poc@template-ai.local', 'POC User', 'auth0|poc');

RESET app.current_user_id;

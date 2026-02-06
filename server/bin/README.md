# Server Scripts

This directory contains utility scripts for managing the Coop server.

## get-invite-token.ts

Retrieves the signup invite link for a user that was invited from the UI.

### Usage

From the `server` directory, run:

```bash
npm run get-invite -- --email "user@example.com"
```

### Parameters

- `--email`: Email address of the invited user (required)

### Output

The script will display:
- Invite details (email, role, org ID, created date)
- **Signup URL** - The full URL to complete signup

### Example Output

```
✅ Invite Token Found!

════════════════════════════════════════════════════════════
Invite Details:
════════════════════════════════════════════════════════════
Email:         user@example.com
Role:          MODERATOR
Organization:  abc123xyz
Created At:    2025-12-10T20:15:30.000Z

════════════════════════════════════════════════════════════
🔗 Signup URL:
════════════════════════════════════════════════════════════

http://localhost:3000/signup/a1b2c3d4e5f6...

Copy this URL and paste it in your browser to sign up.
════════════════════════════════════════════════════════════
```

### Notes

- Invite tokens are stored in the `public.invite_user_tokens` table.
- Emails are normally sent to new users, but require SENDGRID token for this.
- The script shows the most recent invite for the given email.

---

## create-org-and-user.ts

Creates a new organization with an admin user and generates an API key.

### Usage

From the `server` directory, run:

```bash
npm run create-org -- \
  --name "My Organization" \
  --email "admin@example.com" \
  --website "https://example.com" \
  --firstName "John" \
  --lastName "Doe" \
  --password "testpassword123"
```

### Parameters

All parameters are required:

- `--name`: Organization name (must be unique)
- `--email`: Admin user email (must be unique)
- `--website`: Organization website URL (must be a valid URL)
- `--firstName`: Admin user's first name
- `--lastName`: Admin user's last name
- `--password`: Admin user's password (minimum 8 characters recommended)

### Output

The script will output:
- Organization ID
- Organization details (name, email, website)
- Admin user ID and details
- **API Key** - This is only shown once! Copy and store it securely.

### Example Output

```
✅ Organization and admin user created successfully!

════════════════════════════════════════════════════════════
Organization Details:
════════════════════════════════════════════════════════════
Organization ID:   abc123xyz
Organization Name: My Organization
Organization Email: admin@example.com
Website URL:       https://example.com

════════════════════════════════════════════════════════════
Admin User Details:
════════════════════════════════════════════════════════════
User ID:           user456def
Name:              John Doe
Email:             admin@example.com
Role:              ADMIN

════════════════════════════════════════════════════════════
🔑 API KEY (STORE THIS SECURELY!)
════════════════════════════════════════════════════════════

New API key generated successfully! Please copy and store it securely.

API Key: ABC123-XYZ789-DEF456-GHI012

⚠️  This API key will not be shown again. Save it now!
════════════════════════════════════════════════════════════
```

### What Gets Created

The script performs the following actions:

1. **Creates an Organization** with the provided details
2. **Generates an API Key** for the organization
3. **Creates Signing Keys** for JWT token verification
4. **Initializes Organization Settings**:
   - Default user type for moderation
   - Default user interface settings
   - Default organization settings
   - Default manual review tool settings
5. **Creates an Admin User** with:
   - Password login method enabled
   - Admin role permissions
   - Approved status

### Notes

- The API key is only displayed once. Make sure to copy and store it securely.
- The organization name and email must be unique in the database.
- The password should be strong and at least 8 characters long.
- All database connections are properly closed after the script completes.

### Troubleshooting

If the script fails:
- Check that your database connection is configured correctly in `.env`
- Verify that the organization name and email don't already exist
- Ensure the website URL is valid (must start with `http://` or `https://`)
- Check the console output for specific error messages


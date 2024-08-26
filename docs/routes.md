# Routes
All applicable request headers are required.

## `GET` /
Redirects to https://github.com/Beastslash/agreement-center-server/tree/production/docs. The app redirects to this page so that developers know where the documentation is.

### Request headers
None.

### Responses
| Status code | Description |
| :- | :- |
| 301 | Continue to the documentation page on GitHub. |
| 500 | Internal server error. Try again later. |

### URL parameters
None.

## `POST` /authentication/access-token
Creates and returns an [access token object](./objects.md#access-token-object) for using authenticated API endpoints. The access token will expire when the server restarts.

This endpoint also invalidates the given verification code.

### Request headers
| Header name | Description |
| :- | :- |
| `email-address` | The email address of the authorized user. |
| `verification-code` | The verification code created by the API. |

### Responses
| Status code | Description |
| :- | :- |
| 201 | Access token created and verification code invalidated. |
| 400 | Bad request. Check `message` key in body for more information. |
| 401 | Unauthenticated. Supply a valid `email-address` and `verification-code` header. |
| 403 | Forbidden. The email address you provided has been temporarily blocked to protect the owner. |
| 429 | Too many requests. Your IP address has been blocked from this endpoint until a specific time. |
| 500 | Internal server error. Try again later. |

### URL parameters
None.

## `POST` /authentication/verification-code
Sends a verification code email to an authorized email address. This endpoint does nothing if the email is unauthorized.

### Request headers
| Header name | Description |
| :- | :- |
| `email-address` | The email address of the authorized user. |

### URL parameters
None.

### Responses
| Status code | Description |
| :- | :- |
| 202 | Valid request received, but the server won't tell the client if the code was sent. |
| 400 | Bad request. Check `message` key in body for more information. |
| 403 | Forbidden. The email address you provided has been temporarily blocked for security reasons. Try again later. |
| 429 | Too many requests. Your IP address has been blocked from this endpoint until a specific time. |
| 500 | Internal server error. Try again later. |

## `GET` /agreements
Returns a list of [agreement objects](./objects.md#agreement-object) that the authenticated user has access to.

### Request headers
| Header name | Description |
| :- | :- |
| `access-token` | An access token provided by the API. |

### URL parameters
None.

### Responses
| Status code | Description |
| :- | :- |
| 200 | OK. |
| 401 | Unauthenticated. Supply a valid `access-token` header. |
| 429 | Too many requests. Your IP address has been blocked from this endpoint until a specific time. |
| 500 | Internal server error. Try again later. |

## `GET` /agreements/`:projectName`/`:agreementName`
Returns an [agreement object](./objects.md#agreement-object).

### Request headers
| Header name | Description |
| :- | :- |
| `access-token` | An access token provided by the API. |

### Responses
| Status code | Description |
| :- | :- |
| 200 | OK. |
| 400 | Bad request. Check `message` key in body for more information. |
| 401 | Unauthenticated. Supply a valid `access-token` header. |
| 404 | Agreement not found. Verify the path and try again. |
| 429 | Too many requests. Your IP address has been blocked from this endpoint until a specific time. |
| 500 | Internal server error. Try again later. |

### URL parameters
| Parameter name | Description |
| :- | :- |
| `mode` | If this parameter equals `sign`, it creates a view event in the database, allowing the authenticated user to sign the agreement. All other values are ignored. |

## `POST` /agreements/`:projectName`/`:agreementName`/sign
Signs an agreement on behalf of the authenticated user.

### Request headers
| Header name | Description |
| :- | :- |
| `access-token` | An access token provided by the API. |

### Responses
| Status code | Description |
| :- | :- |
| 200 | OK. |
| 400 | Bad request. Check `message` key in body for more information. |
| 401 | Unauthenticated. Supply a valid `access-token` header. |
| 404 | Agreement not found. Verify the path and try again. |
| 429 | Too many requests. Your IP address has been blocked from this endpoint until a specific time. |
| 500 | Internal server error. Try again later. |

### URL parameters
None.
# Objects
## Access token object
| Key | Type | Description |
| :- | :- | :- |
| `accessToken` | String | Access token of the authenticated user. |

## Agreement object
| Key | Type | Description |
| :- | :- | :- |
| `text` | String | The text of the agreement. |
| `inputs` | An array of [input objects](#input-object) | The inputs of the agreement. |
| `permissions` | An array of [permission objects](#permission-object) | The permissions of the agreement. |

## Input object
| Key | Type | Description |
| :- | :- | :- |
| `type` | An [input type](#input-type-enum) | The type of the input. |
| `label` | String | The text shown along the input. |
| `ownerID` | String | The ID (email address) of the person who owns the input. This person is the only person who may modify the input value. |
| `isAutofilled` | Boolean? | Disables the input and uses a current, autofilled value. This only works with date inputs. |
| `value` | (String \| Number)? | The value of the input. |

## Input type enum
| Name | Value |
| :- | :- |
| Text | 0 |
| Date | 1 |

## Permission object
| Key | Type | Description |
| :- | :- | :- |
| `viewerIDs` | An array of strings | The type of the input. |
| `reviewerIDs` | An array of strings | The text shown along the input. |
/**
 * A same-origin page that doesn't open the editor's database, so a test can clear storage
 * without `deleteDatabase` being blocked by an open connection.
 */
export const BLANK_PAGE = "/favicon.svg";

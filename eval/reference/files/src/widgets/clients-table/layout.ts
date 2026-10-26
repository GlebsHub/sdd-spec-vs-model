/** Высота строки фиксированная (п. 8). */
export const ROW_HEIGHT = 48;
/** Запас строк сверху и снизу видимой области (п. 8: не более 10). */
export const OVERSCAN = 10;
/** Следующая порция запрашивается, когда до конца загруженных строк остаётся столько строк или меньше. */
export const PREFETCH_THRESHOLD = 10;
export const SKELETON_ROWS = 10;
/** id для scroll restoration роутера: атрибут контейнера и `useElementScrollRestoration` (conventions §5.3). */
export const CLIENTS_TABLE_SCROLL_ID = "clients-table";

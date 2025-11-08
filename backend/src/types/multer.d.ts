declare module 'multer' {
  interface MulterInstance {
    single(field: string): any;
    array(field: string, maxCount?: number): any;
    fields(fields: Array<{ name: string; maxCount?: number }>): any;
  }
  function multer(options?: any): MulterInstance;
  export default multer;
}

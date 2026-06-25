declare module 'chrome-remote-interface' {
  /** Default export is a function that returns a CDP client */
  export default function CDP(opts?: any): Promise<any>
}

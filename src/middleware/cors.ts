import type { RequestHandler, Request, Response, NextFunction } from 'express';

export function corsMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '*';

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');

    const requestHeaders = req.headers['access-control-request-headers'];
    if (requestHeaders) {
      res.setHeader('Access-Control-Allow-Headers', requestHeaders);
    } else {
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Length', '0');
      return res.status(204).end();
    }

    next();
  };
}

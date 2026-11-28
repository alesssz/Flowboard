// Defences every request goes through before its route: the Host and Origin checks and the security headers.
import type { RequestHandler } from 'express';
import { sendError } from './errors.ts';

/** Always accepted: a page can never make the browser send these for a host it controls. */
const localHosts = ['localhost', '127.0.0.1', '[::1]'];

export function isLocalHost(hostname: string): boolean {
  return localHosts.includes(hostname.toLowerCase());
}

/** A host name, without port, that the API answers to: localhost or one of ALLOWED_HOSTS. */
export function isAllowedHost(hostname: string | undefined, allowedHosts: readonly string[]): boolean {
  return hostname !== undefined && (isLocalHost(hostname) || allowedHosts.includes(hostname.toLowerCase()));
}

/** No Origin (a client other than a browser, or a same-origin GET), or one of a host the API answers to. */
export function isAllowedOrigin(origin: string | undefined, allowedHosts: readonly string[]): boolean {
  return origin === undefined || isAllowedHost(hostnameOf(origin), allowedHosts);
}

/** ALLOWED_HOSTS: host names, without port, comma-separated. */
export function readAllowedHosts(value = process.env.ALLOWED_HOSTS): string[] {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '');
}

/**
 * A 403 for a Host header naming anything but the API itself, so a page that rebinds its own domain
 * to 127.0.0.1 (DNS rebinding) cannot reach it through the browser.
 */
export function checkHost(allowedHosts: readonly string[]): RequestHandler {
  return (req, res, next) => {
    // Express takes the port off, and gives undefined with no Host header; without `trust proxy`,
    // X-Forwarded-Host is ignored.
    const hostname: string | undefined = req.hostname;
    if (!isAllowedHost(hostname, allowedHosts)) {
      sendError(res, 403, 'Host not allowed');
      return;
    }
    next();
  };
}

const readOnlyMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * A 403 for a write sent by a page of another site, which the browser names in Origin: the session cookie
 * is SameSite=Lax, and this also covers sites that count as the same one (a sibling subdomain). Clients
 * other than browsers send no Origin and pass.
 */
export function checkOrigin(allowedHosts: readonly string[]): RequestHandler {
  return (req, res, next) => {
    if (readOnlyMethods.has(req.method) || isAllowedOrigin(req.get('Origin'), allowedHosts)) {
      next();
      return;
    }
    sendError(res, 403, 'Origin not allowed');
  };
}

// '' for an Origin that is not a URL, such as "null" from a sandboxed frame or a file.
function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

/** Headers for a JSON API: nothing in a response runs, is framed, sniffed, cached or read by another origin. */
export const setSecurityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  });
  next();
};

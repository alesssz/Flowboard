// Defences every request goes through before its route: the Host check and the security headers.
import type { RequestHandler } from 'express';
import { sendError } from './errors.ts';

/** Always accepted: a page can never make the browser send these for a host it controls. */
const localHosts = ['localhost', '127.0.0.1', '[::1]'];

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
  const allowed = new Set([...localHosts, ...allowedHosts]);
  return (req, res, next) => {
    // Express takes the port off, and gives undefined with no Host header; without `trust proxy`,
    // X-Forwarded-Host is ignored.
    const hostname: string | undefined = req.hostname;
    if (hostname === undefined || !allowed.has(hostname.toLowerCase())) {
      sendError(res, 403, 'Host not allowed');
      return;
    }
    next();
  };
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

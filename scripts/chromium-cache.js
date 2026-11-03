import { existsSync } from 'fs';

export function chromiumReady(exe, exists = existsSync) {
    return typeof exe === 'string' && exe.length > 0 && exists(exe);
}

// What a member may do on their board; the API checks it on every write, the web app hides what a role cannot do.
// Kept free of Zod, like palette.ts: the web app imports the list for its role picker.

/** From most to least allowed. The database's MemberRole enum must list the same values. */
export const memberRoles = ['owner', 'editor', 'viewer'] as const;

/**
 * owner: everything, and the board's members, title and deletion; editor: columns, cards, labels and comments;
 * viewer: reads, and writes comments. Every board keeps an owner.
 */
export type MemberRole = (typeof memberRoles)[number];

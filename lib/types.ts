export type Note = { id: number; title: string; description: string; categoryId: number; background: string; pinned: boolean; updatedAt: number };
export type Category = { id: number; name: string; color?: string; pinned?: boolean };
export type DeletedNote = Note & { deletedAt: number };

export type DeletedCategory = Category & { deletedAt: number; noteIds: number[] };
export type TrashSelection = { noteIds: number[]; categoryIds: number[] };

export type BadgeKind = 'none' | 'cockade' | 'seal';

export interface CommentItem {
  id: string;
  imageId: string;
  rootId: string;
  parentId: string | null;
  nickname: string;
  content: string;
  html: string;
  createdAt: number;
  likeCount: number;
  likedByMe: boolean;
  verified?: boolean;
  /** Optional lookup key for the current profile; nickname keeps the published byline. */
  authorId?: string | null;
  /** Whitelisted OS label the commenter chose to disclose (e.g. "Windows"). */
  osLabel?: string | null;
  /** Current account badge, included by the comment API even for old comments. */
  authorBadge?: BadgeKind | null;
  /** Current account avatar URL, not a frozen comment-time image. */
  authorAvatar?: string | null;
  ownedByMe?: boolean;
  editable?: boolean;
}

/** Public profile data served by the central `/api/auth/profiles` endpoint. */
export interface PublicProfile {
  username: string | null;
  displayName: string;
  badge: BadgeKind | string;
  avatar: string | null;
  bio: string | null;
  website: string | null;
  email: string | null;
}

export interface AccountUser {
  id: string;
  username: string | null;
  email: string | null;
  emailVerified: boolean;
  badge: BadgeKind;
  displayName: string;
  hasPassword: boolean;
  googleLinked: boolean;
  avatar: string | null;
  bio: string | null;
  showBio: boolean;
  website: string | null;
  publicEmailMode: 'none' | 'login' | 'custom';
  publicEmail: string | null;
}

export interface CommentAppState {
  imageId: string;
  viewerId: string;
  adminToken: string;
  replyTo: CommentItem | null;
  comments: CommentItem[];
  loadedImageId: string;
  loading: boolean;
  loadAgain: boolean;
  loadError: string;
  previewing: boolean;
}

export interface ParentMessage {
  type?: string;
  imageId?: string;
  viewerId?: string;
  token?: string;
  theme?: 'light' | 'dark';
}

export type PullPhase = 'start' | 'move' | 'end' | 'cancel';

export interface PullMessage {
  type: 'comment-ui:pull';
  phase: PullPhase;
  deltaY?: number;
  velocityY?: number;
}

export interface ResizeMessage {
  type: 'comment-ui:resize';
  height: number;
}

export type ParentOutboundMessage =
  | { type: 'comment-ui:ready' }
  | { type: 'comment-ui:loaded'; imageId: string; commentCount: number; commentedByMe?: boolean }
  | { type: 'comment-ui:close' }
  | { type: 'comment-ui:request-admin' }
  | ResizeMessage
  | PullMessage;

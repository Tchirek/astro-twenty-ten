import styles from './passport.css?inline';
import { createAuth } from './auth';
import { createModal } from './modal';
import type { PassportConfig } from './config';
import { commentNickname } from './comments';
import { createPassportApi } from './passportApi';
import { showProfileCard } from './profileCard';
import type { AccountUser, CommentItem, PublicProfile } from './types';

// Keep identity styles in this lazy module: Astro hoists ordinary CSS imports.
const stylesheet = document.createElement('style');
stylesheet.textContent = styles;
document.head.append(stylesheet);

interface PassportOptions {
  config: PassportConfig;
  container: HTMLElement;
  anonymousNickname: string;
  onChange: (account: AccountUser | null) => void;
}

export function createPassport({ config, container, anonymousNickname, onChange }: PassportOptions) {
  const api = createPassportApi(config);
  let destroyed = false;
  const profiles: Record<string, PublicProfile> = {};
  const modal = createModal(container);
  const auth = createAuth({
    config,
    api,
    modal,
    onChange: () => onChange(auth.account())
  });

  async function refresh(): Promise<void> {
    await auth.refresh();
    onChange(auth.account());
  }

  async function openProfile(item: CommentItem): Promise<void> {
    const authorId = item.authorId;
    if (!authorId) return;
    let profile: PublicProfile | null = profiles[authorId] ?? null;
    if (!profile) {
      try {
        const response = await api.profiles([authorId]);
        profile = response.profiles[authorId] ?? null;
        if (profile) profiles[authorId] = profile;
      } catch {
        profile = null;
      }
    }
    if (destroyed) return;
    showProfileCard(
      profile ?? {
        username: null,
        displayName: commentNickname(item.nickname, anonymousNickname),
        badge: item.authorBadge ?? 'none',
        avatar: item.authorAvatar ?? null,
        bio: null,
        website: null,
        email: null
      },
      config.authOrigin,
      modal,
      config.locale
    );
  }

  return {
    account: auth.account,
    token: auth.token,
    refresh,
    open: auth.open,
    openProfile,
    destroy: () => {
      destroyed = true;
      auth.destroy();
    }
  };
}

export type Passport = ReturnType<typeof createPassport>;

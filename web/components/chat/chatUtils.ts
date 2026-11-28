// Shared by 1:1 chats (app/messages/Messages.tsx) and group chats (components/chat/Groups.tsx)
export const EMOJI = ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😇', '🤔', '🙄', '😴', '😭', '😢', '😡', '🤯', '😱', '🤗',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️', '👋', '🫶', '❤️', '💔', '🔥', '💯', '✨', '🎉', '🎂', '🎁', '📚', '✍️', '🎓', '💻', '☕', '🍕', '🏏', '⚽', '🎶', '🎮', '🚌', '🏠'];
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🎉', '🙏'];
export const POST_LINK = /\/community\/post\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
export const onlyEmoji = (t: string) => t.length <= 16 && /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D|\s)+$/u.test(t.trim());

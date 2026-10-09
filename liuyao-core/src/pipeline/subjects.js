/* Who the question is about → which line is the 用神 (增删卜易 用神章).
   The model reads the question and names the subject. The program maps the
   subject to a line by this table, so the choice of 用神 is never left to a
   model. Each row cites the chapter line it comes from. */

export const SUBJECTS = [
  'self', 'parent', 'sibling', 'child', 'spouse', 'wealth', 'official', 'friend', 'house', 'document'
];

const BY_SUBJECT = {
  self: { key: 'self', source: '用神章：自占，以世爻为用神' },
  parent: { key: 'parent', source: '用神章：占父母，以父母爻为用神' },
  sibling: { key: 'peer', source: '用神章：占兄弟、姐妹，以兄弟爻为用神' },
  child: { key: 'output', source: '用神章：占子孙、子女，以子孙爻为用神' },
  wealth: { key: 'wealth', source: '用神章：占妻妾、婢仆及财物，以妻财爻为用神' },
  official: { key: 'officer', source: '用神章：占功名、官府，以官鬼爻为用神' },
  friend: { key: 'ying', source: '用神章：占朋友、外人，以应爻为用神' },
  house: { key: 'parent', source: '用神章：占宅舍、屋宇，以父母爻为用神' },
  document: { key: 'parent', source: '用神章：占章奏、文书，以父母爻为用神' }
};

/* 妻 is 妻财 when a man asks, and 官鬼 when a woman asks (用神章: 占妻妾 → 妻财;
   妻占夫 → 官鬼). With the asker's sex unknown the program does not guess. */
export function yongFor(subject, askerGender) {
  if (!SUBJECTS.includes(subject)) return { clarify: `问题中的对象（${subject}）无法对应到用神` };
  if (subject === 'spouse') {
    if (askerGender === 'male') {
      return { key: 'wealth', source: '用神章：占妻妾，以妻财爻为用神' };
    }
    if (askerGender === 'female') {
      return { key: 'officer', source: '用神章：妻占夫，以官鬼爻为用神' };
    }
    return { clarify: '问的是配偶，需要确认提问人的性别，才能取用神（男占妻取妻财，女占夫取官鬼）' };
  }
  return { ...BY_SUBJECT[subject] };
}

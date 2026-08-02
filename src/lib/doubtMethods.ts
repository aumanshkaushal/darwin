import { Pool } from "pg";

export async function getLastDoubtByUserId(
  db: Pool,
  userId: string,
): Promise<any | null> {
  const { rows } = await db.query(
    `SELECT * FROM doubts WHERE author = $1 AND status != 'deleted' ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

export async function generateDoubtID(db: Pool): Promise<string> {
  const { rows } = await db.query("SELECT id FROM doubts");
  const existingDoubtIds = rows.map((row) => row.id as string);
  const upperString = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numberString = "0123456789";
  let doubtId = "";

  while (!doubtId || existingDoubtIds.includes(doubtId)) {
    doubtId =
      upperString.charAt(Math.floor(Math.random() * upperString.length)) +
      upperString.charAt(Math.floor(Math.random() * upperString.length)) +
      numberString.charAt(Math.floor(Math.random() * numberString.length)) +
      numberString.charAt(Math.floor(Math.random() * numberString.length)) +
      numberString.charAt(Math.floor(Math.random() * numberString.length));
  }
  return doubtId;
}

export async function addDoubt(
  db: Pool,
  doubtId: string,
  author: string,
  description: string,
  messageId: string,
  channelId: string,
  subject: string,
  grade: string,
  image?: string,
): Promise<string> {
  const id = doubtId;
  const createdAt = Math.floor(Date.now() / 1000);
  await db.query(
    `
        INSERT INTO doubts (id, author, description, image, created_at, message_id, channel_id, subject, grade, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
    [
      id,
      author,
      description,
      image || null,
      createdAt,
      messageId,
      channelId,
      subject,
      grade,
      "open",
    ],
  );
  return id;
}

export async function editDoubtDescription(
  db: Pool,
  id: string,
  newDescription: string,
): Promise<void> {
  const result = await db.query(
    `UPDATE doubts SET description = $1 WHERE id = $2 AND status != 'deleted'`,
    [newDescription, id],
  );
  if (result.rowCount === 0)
    throw new Error(`Doubt ${id} not found or already deleted`);
}

export async function deleteDoubt(db: Pool, id: string): Promise<void> {
  const result = await db.query(
    `UPDATE doubts SET status = 'deleted' WHERE id = $1 AND status != 'deleted'`,
    [id],
  );
  if (result.rowCount === 0)
    throw new Error(`Doubt ${id} not found or already deleted`);
}

export async function markDoubtAsSolved(
  db: Pool,
  id: string,
  solvedBy: string,
  solvedMessageId: string,
  solvedChannelId: string,
): Promise<void> {
  const solvedAt = Math.floor(Date.now() / 1000);
  const result = await db.query(
    `
        UPDATE doubts
        SET status = 'solved', solved_by = $1, solved_at = $2, solved_message_id = $3, solved_channel_id = $4
        WHERE id = $5 AND status = 'open'
        `,
    [solvedBy, solvedAt, solvedMessageId, solvedChannelId, id],
  );
  if (result.rowCount === 0)
    throw new Error(`Doubt ${id} not found or not open`);
}

export async function lastDoubtAsked(
  db: Pool,
  userId: string,
): Promise<number> {
  const { rows } = await db.query(
    `SELECT created_at FROM doubts WHERE author = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  if (!rows.length) return 6 * 60 * 60 * 1000;
  const lastTime = (rows[0].created_at as number) * 1000;
  return Date.now() - lastTime;
}

export async function getDoubtById(db: Pool, id: string): Promise<any> {
  const { rows } = await db.query(`SELECT * FROM doubts WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function searchDoubts(
  db: Pool,
  subject: string,
  grade: string,
  keyword?: string,
): Promise<any[]> {
  let query: string;
  let params: any[] = [];

  if (keyword) {
    const normalizedQuery = keyword
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " & ")
      .split(" & ")
      .map((term) => `${term}:*`)
      .join(" & ");
    query = `
            SELECT *
            FROM doubts
            WHERE subject = $1
                AND grade = $2
                AND search_vector @@ to_tsquery('english', $3)
            ORDER BY ts_rank_cd(search_vector, to_tsquery('english', $3), 32) DESC
            LIMIT 25;
        `;
    params = [subject, grade, normalizedQuery];
  } else {
    query = `
            SELECT *
            FROM doubts
            WHERE subject = $1
                AND grade = $2
            ORDER BY created_at DESC
            LIMIT 25;
        `;
    params = [subject, grade];
  }

  const { rows } = await db.query(query, params);
  return rows;
}

export async function getDoubtsForArchive(
  db: Pool,
  subject: string,
  grade: string,
): Promise<any[]> {
  const { rows } = await db.query(
    `SELECT * FROM doubts WHERE subject = $1 AND grade = $2 AND status = 'solved'`,
    [subject, grade],
  );
  return rows;
}

export async function checkCooldown(
  db: Pool,
  userId: string,
  cooldownMs: number,
): Promise<boolean> {
  const sixHoursAgo = Math.floor(Date.now() / 1000) - 6 * 60 * 60;
  const { rows } = await db.query(
    `SELECT COUNT(*) as count FROM doubts WHERE author = $1 AND status != 'deleted' AND created_at >= $2`,
    [userId, sixHoursAgo],
  );
  const count = Number(rows[0].count) || 0;
  return count >= 3;
}

export async function userCooldownTime(
  db: Pool,
  userId: string,
): Promise<number> {
  const { rows } = await db.query(
    `SELECT created_at FROM doubts WHERE author = $1 AND status != 'deleted' ORDER BY created_at DESC LIMIT 3`,
    [userId],
  );
  if (rows.length < 3) return 0;

  const thirdLastDoubtTime = (rows[2].created_at as number) * 1000;
  const cooldownEndTime = thirdLastDoubtTime + 6 * 60 * 60 * 1000;
  const remainingCooldownTime = cooldownEndTime - Date.now();
  return remainingCooldownTime > 0 ? remainingCooldownTime : 0;
}

export async function getUserDoubtCount(
  db: Pool,
  userId: string,
): Promise<number> {
  const { rows } = await db.query(
    `SELECT COUNT(*) as count FROM doubts WHERE author = $1`,
    [userId],
  );
  return Number(rows[0].count) || 0;
}

export async function undoSolveDoubt(db: Pool, id: string): Promise<void> {
  const result = await db.query(
    `
        UPDATE doubts
        SET status = 'open', solved_by = NULL, solved_at = NULL, solved_message_id = NULL, solved_channel_id = NULL
        WHERE id = $1 AND status = 'solved'
        `,
    [id],
  );
  if (result.rowCount === 0)
    throw new Error(`Doubt ${id} not found or not solved`);
}

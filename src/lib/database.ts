import { Pool } from "pg";
import * as doubtMethods from "./doubtMethods";
import * as privateVCMethods from "./privateVCMethods";
import * as resourceMethods from "./resourceMethods";
import * as userMethods from "./userMethods";

export class DatabaseManager {
  private dbPool: Pool;

  constructor() {
    this.dbPool = new Pool({
      user: process.env.dbUser,
      host: process.env.dbHost,
      database: process.env.dbName,
      password: process.env.dbPassword,
      port: Number(process.env.dbPort),
    });

    this.initializeSchema();
  }

  async initializeSchema() {
    try {
      await this.dbPool.query(`
                CREATE TABLE IF NOT EXISTS resources (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    tag TEXT NOT NULL,
                    url TEXT NOT NULL,
                    description TEXT,
                    author TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    staff_action_at INTEGER,
                    staff_action_by TEXT,
                    status TEXT NOT NULL
                );
            `);

      await this.dbPool.query(`
                CREATE TABLE IF NOT EXISTS reviews (
                    id SERIAL PRIMARY KEY,
                    resource_id TEXT NOT NULL,
                    reviewer TEXT NOT NULL,
                    rating INTEGER NOT NULL,
                    comment TEXT,
                    created_at INTEGER,
                    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
                );
            `);

      await this.dbPool.query(`
                CREATE SEQUENCE IF NOT EXISTS reviews_id_seq OWNED BY reviews.id;
            `);
      await this.dbPool.query(`
                ALTER TABLE reviews ALTER COLUMN id SET DEFAULT nextval('reviews_id_seq'::regclass);
            `);
      await this.dbPool.query(`
                SELECT setval('reviews_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM reviews));
            `);

      await this.dbPool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    supportpoints INTEGER NOT NULL DEFAULT 0,
                    last_active INTEGER,
                    bookmark JSONB NOT NULL,
                    pronouns TEXT,
                    locked_studymode BOOLEAN NOT NULL DEFAULT FALSE
                );
            `);

      await this.dbPool.query(`
                CREATE TABLE IF NOT EXISTS doubts (
                    id TEXT PRIMARY KEY,
                    author TEXT NOT NULL,
                    description TEXT NOT NULL,
                    image TEXT,
                    created_at INTEGER NOT NULL,
                    message_id TEXT NOT NULL,
                    channel_id TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    grade TEXT NOT NULL,
                    status TEXT NOT NULL,
                    solved_by TEXT,
                    solved_at INTEGER,
                    solved_message_id TEXT,
                    solved_channel_id TEXT
                );
            `);

      await this.dbPool.query(`
                CREATE TABLE IF NOT EXISTS privatevc (
                    id TEXT PRIMARY KEY,
                    ownerID TEXT
                );
            `);
    } catch (err) {
      console.error("Failed to initialize schema:", err);
      throw err;
    }
  }

  get client() {
    return this.dbPool;
  }

  getResource(id: string) {
    return resourceMethods.getResource(this.dbPool, id);
  }

  serveResources(tag: string = "ALL", search: string = "") {
    return resourceMethods.serveResources(this.dbPool, tag, search);
  }

  getAverageRating(resourceID: string) {
    return resourceMethods.getAverageRating(this.dbPool, resourceID);
  }

  hasRated(resourceID: string, userID: string) {
    return resourceMethods.hasRated(this.dbPool, resourceID, userID);
  }

  rateResource(
    resourceID: string,
    reviewer: string,
    rating: number,
    comment: string,
  ) {
    return resourceMethods.rateResource(
      this.dbPool,
      resourceID,
      reviewer,
      rating,
      comment,
    );
  }

  deleteResource(resourceID: string, staffActionBy: string) {
    return resourceMethods.deleteResource(
      this.dbPool,
      resourceID,
      staffActionBy,
    );
  }

  editTitle(resourceID: string, newTitle: string, staffActionBy: string) {
    return resourceMethods.editTitle(
      this.dbPool,
      resourceID,
      newTitle,
      staffActionBy,
    );
  }

  editTag(resourceID: string, newTag: string, staffActionBy: string) {
    return resourceMethods.editTag(
      this.dbPool,
      resourceID,
      newTag,
      staffActionBy,
    );
  }

  editDescription(
    resourceID: string,
    newDescription: string,
    staffActionBy: string,
  ) {
    return resourceMethods.editDescription(
      this.dbPool,
      resourceID,
      newDescription,
      staffActionBy,
    );
  }

  editUrl(resourceID: string, newUrl: string, staffActionBy: string) {
    return resourceMethods.editUrl(
      this.dbPool,
      resourceID,
      newUrl,
      staffActionBy,
    );
  }

  editAuthor(resourceID: string, newAuthor: string, staffActionBy: string) {
    return resourceMethods.editAuthor(
      this.dbPool,
      resourceID,
      newAuthor,
      staffActionBy,
    );
  }

  getActiveResourceCountByUser(userID: string) {
    return resourceMethods.getActiveResourceCountByUser(this.dbPool, userID);
  }

  getTotalResourceCountByUser(userID: string) {
    return resourceMethods.getTotalResourceCountByUser(this.dbPool, userID);
  }

  getAverageRatingByUser(userID: string) {
    return resourceMethods.getAverageRatingByUser(this.dbPool, userID);
  }

  getReviewCountByUser(userID: string) {
    return resourceMethods.getReviewCountByUser(this.dbPool, userID);
  }

  addTemporaryResource(
    title: string,
    tag: string,
    url: string,
    description: string,
    author: string,
  ) {
    return resourceMethods.addTemporaryResource(
      this.dbPool,
      title,
      tag,
      url,
      description,
      author,
    );
  }

  approveTemporaryResource(resourceID: string, staffActionBy: string) {
    return resourceMethods.approveTemporaryResource(
      this.dbPool,
      resourceID,
      staffActionBy,
    );
  }

  declineTemporaryResource(resourceID: string, staffActionBy: string) {
    return resourceMethods.declineTemporaryResource(
      this.dbPool,
      resourceID,
      staffActionBy,
    );
  }

  generateResourceID() {
    return resourceMethods.generateResourceID(this.dbPool);
  }

  checkDuplicate(field: string, value: string) {
    return resourceMethods.checkDuplicate(this.dbPool, field, value);
  }

  initializeUser(userId: string) {
    return userMethods.initializeUser(this.dbPool, userId);
  }

  getTopUsers() {
    return userMethods.getTopUsers(this.dbPool);
  }

  getSupportPoints(userId: string) {
    return userMethods.getSupportPoints(this.dbPool, userId);
  }

  addSupportPoints(userId: string, supportPoints: number) {
    return userMethods.addSupportPoints(this.dbPool, userId, supportPoints);
  }

  getLeaderboardPosition(userId: string) {
    return userMethods.getLeaderboardPosition(this.dbPool, userId);
  }

  getTotalUsers() {
    return userMethods.getTotalUsers(this.dbPool);
  }

  setUserPronouns(userId: string, pronouns: string) {
    return userMethods.setUserPronouns(this.dbPool, userId, pronouns);
  }

  getUserPronouns(userId: string) {
    return userMethods.getUserPronouns(this.dbPool, userId);
  }

  lockStudyMode(userId: string) {
    return userMethods.lockStudyMode(this.dbPool, userId);
  }

  unlockStudyMode(userId: string) {
    return userMethods.unlockStudyMode(this.dbPool, userId);
  }

  isStudyModeLocked(userId: string) {
    return userMethods.isStudyModeLocked(this.dbPool, userId);
  }

  generateDoubtID() {
    return doubtMethods.generateDoubtID(this.dbPool);
  }

  addDoubt(
    doubtId: string,
    author: string,
    description: string,
    messageId: string,
    channelId: string,
    subject: string,
    grade: string,
    image?: string,
  ) {
    return doubtMethods.addDoubt(
      this.dbPool,
      doubtId,
      author,
      description,
      messageId,
      channelId,
      subject,
      grade,
      image,
    );
  }

  editDoubtDescription(id: string, newDescription: string) {
    return doubtMethods.editDoubtDescription(this.dbPool, id, newDescription);
  }

  deleteDoubt(id: string) {
    return doubtMethods.deleteDoubt(this.dbPool, id);
  }

  markDoubtAsSolved(
    id: string,
    solvedBy: string,
    solvedMessageId: string,
    solvedChannelId: string,
  ) {
    return doubtMethods.markDoubtAsSolved(
      this.dbPool,
      id,
      solvedBy,
      solvedMessageId,
      solvedChannelId,
    );
  }

  lastDoubtAsked(userId: string) {
    return doubtMethods.lastDoubtAsked(this.dbPool, userId);
  }

  getDoubtById(id: string) {
    return doubtMethods.getDoubtById(this.dbPool, id);
  }

  searchDoubts(subject: string, grade: string, keyword?: string) {
    return doubtMethods.searchDoubts(this.dbPool, subject, grade, keyword);
  }

  getDoubtsForArchive(subject: string, grade: string) {
    return doubtMethods.getDoubtsForArchive(this.dbPool, subject, grade);
  }

  checkCooldown(userId: string, cooldownMs: number) {
    return doubtMethods.checkCooldown(this.dbPool, userId, cooldownMs);
  }

  userCooldownTime(userId: string) {
    return doubtMethods.userCooldownTime(this.dbPool, userId);
  }

  getUserDoubtCount(userId: string) {
    return doubtMethods.getUserDoubtCount(this.dbPool, userId);
  }

  getLastDoubtByUserId(userId: string) {
    return doubtMethods.getLastDoubtByUserId(this.dbPool, userId);
  }

  undoSolveDoubt(id: string) {
    return doubtMethods.undoSolveDoubt(this.dbPool, id);
  }

  setPrivateVC(channelID: string, ownerID: string): Promise<void> {
    return privateVCMethods.setPrivateVC(this.dbPool, channelID, ownerID);
  }

  isPrivateVC(channelID: string): Promise<boolean> {
    return privateVCMethods.isPrivateVC(this.dbPool, channelID);
  }

  getPrivateVCOwner(channelID: string): Promise<string | null> {
    return privateVCMethods.getPrivateVCOwner(this.dbPool, channelID);
  }

  deletePrivateVC(channelID: string): Promise<void> {
    return privateVCMethods.deletePrivateVC(this.dbPool, channelID);
  }

  getPrivateVCByOwner(ownerID: string): Promise<string | null> {
    return privateVCMethods.getPrivateVCByOwner(this.dbPool, ownerID);
  }

  getAllPrivateVCs(): Promise<string[]> {
    return privateVCMethods.getAllPrivateVCs(this.dbPool);
  }
}

export const databaseManager = new DatabaseManager();

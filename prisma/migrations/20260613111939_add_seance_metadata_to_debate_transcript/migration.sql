-- AlterTable
ALTER TABLE "DebateTranscript" ADD COLUMN     "seanceOrder" INTEGER,
ADD COLUMN     "startTime" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DebateTranscript_date_seanceOrder_idx" ON "DebateTranscript"("date", "seanceOrder");

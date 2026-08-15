-- CreateTable
CREATE TABLE "FeynmanCheck" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userExplanation" TEXT NOT NULL,
    "understoodWell" TEXT[],
    "gaps" TEXT[],
    "clarification" TEXT NOT NULL,
    "masteryScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeynmanCheck_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FeynmanCheck" ADD CONSTRAINT "FeynmanCheck_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeynmanCheck" ADD CONSTRAINT "FeynmanCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

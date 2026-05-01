import { Module } from "@nestjs/common";
import { DomainSchemaFirstService } from "./domain-schema-first.service";

@Module({
  providers: [DomainSchemaFirstService],
  exports: [DomainSchemaFirstService],
})
export class DomainSchemaFirstModule {}
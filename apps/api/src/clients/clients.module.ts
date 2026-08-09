import { Module } from "@nestjs/common";
import { PortalModule } from "../portal/portal.module";
import { ClientsRouter } from "./clients.router";
import { ClientsService } from "./clients.service";

@Module({ imports: [PortalModule], providers: [ClientsRouter, ClientsService] })
export class ClientsModule {}

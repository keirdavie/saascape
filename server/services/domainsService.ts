import { ObjectId } from "mongodb"
import { db } from "../db"
import constants from "../helpers/constants"
import Pagination from "../helpers/pagination"
import { IDomain } from "../schemas/Domains"
import ServerService from "./serverService"
import { IServer } from "../schemas/Servers"
import { getDomainConfigFile } from "../modules/nginx"
import { logError } from "../helpers/error"
import queues from "../helpers/queues"

export default class DomainService {
  async findMany(query: any) {
    const pagination = new Pagination(query)
    const findObj: any = {
      status: constants.STATUSES.ACTIVE_STATUS,
    }

    if (query?.searchValue) {
      findObj["$or"] = [
        { domain_name: { $regex: query.searchValue, $options: "i" } },
      ]
    }

    const domains = await pagination.runPaginatedQuery({
      collection: db.managementDb?.collection("domains"),
      findObj,
    })

    return { data: domains }
  }

  async findOne(id: string) {
    const domain = await db.managementDb
      ?.collection("domains")
      .findOne({ _id: new ObjectId(id) })
    if (!domain) throw { showError: "Domain not found" }
    return { domain }
  }

  async addDomain(data: any) {
    const { domain_name } = data
    if (!domain_name) throw { showError: "Domain name is required" }
    const domainNameRegex = new RegExp(
      /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/
    )

    if (!domainNameRegex.test(domain_name)) {
      throw { showError: "Invalid domain name" }
    }

    const foundDomain = await db.managementDb?.collection("domains").findOne({
      domain_name: data.domain_name,
    })
    if (foundDomain) {
      throw { showError: "Domain already exists" }
    }

    const payload: IDomain = {
      domain_name: data.domain_name,
      status: constants.STATUSES.ACTIVE_STATUS,
      description: data.description,
      linked_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    }
    const domain = await db.managementDb
      ?.collection("domains")
      .insertOne(payload)

    return { domain }
  }

  async updateDomain(id: string, data: any) {
    const foundDomain = await db.managementDb?.collection("domains").findOne({
      domain_name: data.domain_name,
      status: constants.STATUSES.ACTIVE_STATUS,
    })

    if (foundDomain && foundDomain?._id.toString() !== id) {
      throw { showError: "Domain already exists" }
    }

    const payload = {
      description: data.description,
      updated_at: new Date(),
    }
    const domain = await db.managementDb
      ?.collection("domains")
      .updateOne({ _id: new ObjectId(id) }, { $set: payload })
    return { domain }
  }

  async beginInitialization(id: string) {
    console.log("begin initialization", id)

    const domain = await db.managementDb
      ?.collection<IDomain>("domains")
      .findOne({ _id: new ObjectId(id) })

    if (!domain) throw new Error("Domain not found")

    // We should prepare the domain to be initialized on each server

    const servers = await db.managementDb
      ?.collection<IServer>("servers")
      .find({ status: constants.STATUSES.ACTIVE_STATUS })
      .toArray()

    await this.addDomainToServer(servers || [], domain)
  }

  async addDomainToServer(servers: IServer[], domain: IDomain) {
    const serverService = new ServerService()

    const newLinkedServers: IDomain["linked_servers"] = []

    for (const server of servers || []) {
      try {
        if (
          !server?._id ||
          server?.availability === constants.AVAILABILITY.OFFLINE
        ) {
          continue
        }

        const configFile = await getDomainConfigFile(domain)

        await serverService.addDomain(server?._id.toString(), {
          domain,
          html: this.#generateBaseIndexHTMLFile(domain),
          configFile,
        })

        newLinkedServers.push({
          server_id: server?._id,
          status: constants.STATUSES.ACTIVE_STATUS,
          last_sync: new Date(),
        })
      } catch (err) {
        const errorObj = {
          message: "Failed to initialize domain on server: " + server?._id,
          rawError: err,
        }
        await logError({
          error: JSON.stringify(errorObj),
          entityId: domain?._id,
          status: constants.STATUSES.FAILED_STATUS,
          module: constants.MODULES.DOMAIN,
          event: queues.DOMAIN.INITIALIZE_DOMAIN,
        })
      }
    }

    await db.managementDb?.collection<IDomain>("domains").updateOne(
      { _id: new ObjectId(domain?._id) },
      {
        $pull: {
          linked_servers: {
            server_id: {
              $in: newLinkedServers.map((server) => server?.server_id),
            },
          },
        },
      }
    )

    await db.managementDb?.collection<IDomain>("domains").updateOne(
      { _id: new ObjectId(domain?._id) },
      {
        $push: {
          linked_servers: {
            $each: newLinkedServers,
          },
        },
      }
    )
  }

  #generateBaseIndexHTMLFile(domain: IDomain) {
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${domain?.domain_name}</title>
    </head>
    <body>
        <h1>${domain?.domain_name}</h1>
    </body>
    </html>`

    return html
  }
}

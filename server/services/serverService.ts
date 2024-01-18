import { NodeSSH } from "node-ssh"
import {
  checkForMissingParams,
  decipherData,
  encryptData,
  getMissingFields,
} from "../helpers/utils"
import fsp from "fs/promises"
import { IServer, IServerDeciphered } from "../schemas/Servers"
import constants from "../helpers/constants"
import { db } from "../db"
import { ObjectId } from "mongodb"
import SSHService from "./sshService"
import { IIntegration } from "../schemas/Integrations"
import { ILinkedId } from "../interfaces/interfaces"

export default class ServerService {
  _id?: ObjectId
  constructor() {}

  async create(data: any) {
    checkForMissingParams(data, [
      "server_ip_address",
      "ssh_port",
      "admin_username",
      "private_key",
      "server_name",
    ])

    // Check if server already exists
    const server = await db.managementDb
      ?.collection<IServer>("servers")
      .findOne({
        server_ip_address: data.server_ip_address,
        status: { $nin: [constants.STATUSES.DELETED_STATUS] },
      })
    if (server) {
      throw { showError: "Server already exists" }
    }

    const payload: IServer = {
      server_ip_address: data.server_ip_address,
      ssh_port: data.ssh_port,
      admin_username: encryptData(data.admin_username),
      private_key: encryptData(data.private_key),
      server_name: data.server_name,
      server_status: constants.SERVER_STATUSES.PENDING_INITIALIZATION,
      status: constants.STATUSES.ACTIVE_STATUS,
      created_at: new Date(),
      updated_at: new Date(),
      linked_ids: [],
    }

    const result = await db.managementDb
      ?.collection<IServer>("servers")
      .insertOne(payload)

    if (!result?.insertedId) throw { showError: "Server could not be created" }

    return { _id: result.insertedId }
  }

  async testConnection(data: any) {
    const missingParams = getMissingFields(data, [
      "server_ip_address",
      "ssh_port",
      "admin_username",
      "private_key",
    ])

    if (missingParams.length > 0) {
      return {
        success: false,
        data: { error: "Missing required params", missingParams },
      }
    }
    const key = await fsp.readFile("/Users/keir/google", "utf8")

    const sshService = new SSHService({
      host: data.server_ip_address,
      port: data.ssh_port,
      username: data.admin_username,
      privateKey: data.private_key,
    })
    await sshService.connect()
    await sshService.testAdmin()

    return { success: true }
  }
  async update(id: string, data: any) {}
  async delete(id: string) {}
  async findMany(query: any) {
    const { search } = query
    const servers = await db.managementDb
      ?.collection<IServer>("servers")
      .find({
        $or: [
          { server_name: { $regex: new RegExp(search, "i") } },
          { server_ip_address: { $regex: new RegExp(search, "i") } },
        ],
      })
      .limit(1000)
      .toArray()

    return { servers }
  }

  async #getDockerInfo(ssh: SSHService) {
    const dockerInfo = await ssh.client
      .execCommand("sudo docker info -f json")
      .catch((error) => {
        console.log(error)
        throw new Error(error?.stderr)
      })

    return JSON.parse(dockerInfo.stdout)
  }
  async #installDocker(ssh: SSHService) {
    console.log("installing docker")
    const osInfo = await ssh.getOsInfo()
    if (osInfo?.OperatingSystemPrettyName.includes("Ubuntu")) {
      await ssh.client.execCommand(
        "for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done"
      )
      await ssh.client.execCommand(
        "sudo apt-get update && sudo apt-get install ca-certificates curl gnupg && sudo install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg && sudo chmod a+r /etc/apt/keyrings/docker.gpg"
      )

      await ssh.client.execCommand(`echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null`)
      await ssh.client.execCommand(
        "sudo apt-get update && sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y"
      )
    } else {
      throw new Error("Only Ubuntu is supported")
    }
  }
  async #createDockerIntegration(dockerInfo: any) {
    const { ID } = dockerInfo
    const { Version } = dockerInfo?.ClientInfo
    const serverId = this._id

    if (!serverId) {
      throw new Error("Missing serverId")
    }

    if (!ID || !Version) {
      throw new Error(
        "Docker info missing values, unable to create integration"
      )
    }
    const payload: IIntegration = {
      _id: new ObjectId(),
      name: constants.INTEGRATIONS.DOCKER,
      status: constants.STATUSES.ACTIVE_STATUS,
      created_at: new Date(),
      updated_at: new Date(),
      config: {
        id: ID,
        version: Version,
      },
      type: constants.INTEGRATION_TYPES.INDEPENDENT,
      module: constants.MODULES.SERVER,
    }

    const result = await db.managementDb
      ?.collection<IIntegration>("integrations")
      .insertOne(payload)

    if (!result?.insertedId) throw new Error("Integration could not be created")

    const linkedIdObj: ILinkedId = {
      _id: new ObjectId(),
      name: constants.INTEGRATIONS.DOCKER,
      integration_id: result?.insertedId,
    }

    await db.managementDb
      ?.collection<IServer>("servers")
      .updateOne(
        { _id: new ObjectId(serverId) },
        { $push: { linked_ids: linkedIdObj } }
      )

    return
  }
  async #getNginxInfo(ssh: SSHService) {
    console.log("getting nginx info")
    const nginxInfo = await ssh.client
      .execCommand("sudo nginx -v 2>&1")
      .catch((error) => {
        console.log(error)
        throw { showError: error?.stderr }
      })

    console.log(nginxInfo)

    if (nginxInfo?.stderr) {
      throw new Error(nginxInfo?.stderr)
    }

    const version = nginxInfo?.stdout?.split("nginx version: ")[1]

    return version
  }
  async #installNginx(ssh: SSHService) {
    console.log("installing nginx")
    const osInfo = await ssh.getOsInfo()
    if (osInfo?.OperatingSystemPrettyName.includes("Ubuntu")) {
      await ssh.client
        .execCommand("sudo apt-get update && sudo apt-get install nginx -y")
        .catch((error) => {
          console.log(error)
          throw new Error(error?.stderr)
        })
    } else {
      throw new Error("Only Ubuntu is supported")
    }
  }
  async #createNginxIntegration(version: string) {
    const serverId = this._id

    const payload: IIntegration = {
      _id: new ObjectId(),
      name: constants.INTEGRATIONS.NGINX,
      status: constants.STATUSES.ACTIVE_STATUS,
      created_at: new Date(),
      updated_at: new Date(),
      config: {
        version,
      },
      type: constants.INTEGRATION_TYPES.INDEPENDENT,
      module: constants.MODULES.SERVER,
    }

    const result = await db.managementDb
      ?.collection<IIntegration>("integrations")
      .insertOne(payload)

    if (!result?.insertedId) throw new Error("Integration could not be created")

    const linkedIdObj: ILinkedId = {
      _id: new ObjectId(),
      name: constants.INTEGRATIONS.NGINX,
      integration_id: result?.insertedId,
    }

    await db.managementDb
      ?.collection<IServer>("servers")
      .updateOne(
        { _id: new ObjectId(serverId) },
        { $push: { linked_ids: linkedIdObj } }
      )

    return
  }
  async beginInitialization(id: string) {
    const server = (await db.managementDb
      ?.collection<IServer>("servers")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            server_status: constants.SERVER_STATUSES.INITIALIZING,
            updated_at: new Date(),
          },
        },
        {
          returnDocument: "after",
        }
      )) as unknown as IServerDeciphered

    if (!server) {
      throw new Error("Server not found")
    }

    this._id = new ObjectId(id)

    server.decipheredData = {
      admin_username: decipherData(
        server.admin_username.encryptedData,
        server.admin_username.iv
      ),
      private_key: decipherData(
        server.private_key?.encryptedData,
        server.private_key?.iv
      ),
    }

    const ssh = new SSHService({
      host: server.server_ip_address,
      port: server.ssh_port,
      username: server.decipheredData.admin_username,
      privateKey: server.decipheredData.private_key,
    })

    await ssh.connect()

    let dockerInfo = await this.#getDockerInfo(ssh).catch(() => false)
    if (!dockerInfo) {
      await this.#installDocker(ssh)
      dockerInfo = await this.#getDockerInfo(ssh)
    }

    // Create docker integration
    await this.#createDockerIntegration(dockerInfo)

    // Nginx
    let nginxInfo = await this.#getNginxInfo(ssh).catch(() => false)
    if (!nginxInfo) {
      await this.#installNginx(ssh)
      nginxInfo = await this.#getNginxInfo(ssh)
    }

    // Create nginx integration
    await this.#createNginxIntegration(nginxInfo as string)
  }
  async finishInitialization(id: string, status: string) {
    let serverStatus = ""
    switch (status) {
      case constants.STATUSES.COMPLETED_STATUS:
        serverStatus = constants.SERVER_STATUSES.SUCCESSFUL_INITIALIZATION
        break

      case constants.STATUSES.FAILED_STATUS:
        serverStatus = constants.SERVER_STATUSES.FAILED_INITIALIZATION
        break

      default:
        serverStatus = constants.SERVER_STATUSES.FAILED_INITIALIZATION
        break
    }

    await db.managementDb?.collection<IServer>("servers").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          server_status: serverStatus,
          updated_at: new Date(),
        },
      }
    )

    // Emit task to main server to notify of completion, server will then notify fe
  }
}

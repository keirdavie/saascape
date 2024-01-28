import { NodeSSH } from "node-ssh"

interface ISSH {
  host: string
  port: number
  username: string
  privateKey: string
}

export default class SSHService {
  client: NodeSSH
  data: ISSH
  constructor(data: ISSH) {
    this.client = new NodeSSH()
    this.data = data
  }

  async connect() {
    await this.client.connect(this.data).catch((error) => {
      console.log(error)
      throw { showError: error.message }
    })
    return "hey"
  }

  async testAdmin() {
    const result = await this.client.execCommand("sudo ls /").catch((error) => {
      console.log(error)
      throw { showError: error?.stderr }
    })
    return result
  }

  async getOsInfo() {
    const osInfo = await this.client
      .execCommand("hostnamectl --json=pretty")
      .catch((error) => {
        console.log(error)
        throw { showError: error?.stderr }
      })

    const obj = JSON.parse(osInfo.stdout)
    return obj
  }
}
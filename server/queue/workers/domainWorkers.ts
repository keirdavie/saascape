import Bull from "bull"
import queues from "../../helpers/queues"
import { getQueue } from "../queue"

import ServerService from "../../services/serverService"
import constants from "../../helpers/constants"
import { logError } from "../../helpers/error"
import DomainService from "../../services/domainsService"
import { initializeSSLOnDomainQueueProducer } from "../producers/domainProducers"

const initializeInitDomainQueue = async () => {
  const queue = getQueue(queues.DOMAIN.INITIALIZE_DOMAIN)
  queue.process(2, async (job: Bull.Job) => {
    console.log(`Initializing domain ${job.data?._id} from Job ${job.id}`)
    const domainService = new DomainService()
    await domainService.beginInitialization(job.data?._id)
  })
  queue.on("failed", async (job) => {
    console.log("failed job")
    await logError({
      error: { message: job.failedReason },
      entityId: job.data?._id,
      status: constants.STATUSES.FAILED_STATUS,
      module: constants.MODULES.DOMAIN,
      event: queues.DOMAIN.INITIALIZE_DOMAIN,
    })
  })
  queue.on("completed", async (job) => {
    try {
      await initializeSSLOnDomainQueueProducer({ _id: job?.data?._id })
    } catch (err) {
      console.warn(err)
    }
  })
}

const initializeSSLOnDomainQueue = async () => {
  const queue = getQueue(queues.DOMAIN.INITIALIZE_SSL_ON_DOMAIN)

  queue.process(2, async (job: Bull.Job) => {
    console.log(
      `Initializing SSL on domain ${job.data?._id} from Job ${job.id}`
    )
    const domainService = new DomainService()
    await domainService.initializeSSL(job.data?._id)
  })

  queue.on("failed", async (job) => {
    console.log("failed to initialize ssl on domain", job.data?._id)
    await logError({
      error: { message: job.failedReason },
      entityId: job.data?._id,
      status: constants.STATUSES.FAILED_STATUS,
      module: constants.MODULES.DOMAIN,
      event: queues.DOMAIN.INITIALIZE_SSL_ON_DOMAIN,
    })
  })
  queue.on("completed", async (job) => {})
}

const initializeQueues = async () => {
  await Promise.allSettled([
    initializeInitDomainQueue(),
    initializeSSLOnDomainQueue(),
  ])
}

export default initializeQueues

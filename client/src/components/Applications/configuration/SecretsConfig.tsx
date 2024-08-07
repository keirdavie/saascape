import { Button, Card, Form, Input, Popconfirm, Table } from 'antd'
import IInstance from 'types/schemas/Instances'
import { updateApplication } from '../../../store/slices/applicationSlice'
import { IApplication } from 'types/schemas/Applications.ts'
import { useEffect, useState } from 'react'
import useEditableTable, { IColumnProps } from '../../../hooks/useEditableTable'
import { useForm } from 'antd/es/form/Form'
import { toast } from 'react-toastify'
import { apiAxiosToast } from '../../../helpers/axios'
import constants from '../../../helpers/constants/constants'
import { useDispatch } from 'react-redux'
import ImportAppVariables from './ImportAppVariables'
import { CSVData } from '../../../helpers/utils'
import CSVImportVariables from './CSVImportVariables.tsx'

interface IProps {
  application?: IApplication
  instance?: IInstance
}

const SecretsConfig = ({ application, instance }: IProps) => {
  const [loading, setLoading] = useState(false)
  //   Secrets below will either be the application config secrets or the instance secrets. If instance is defined then we will use instance secrets
  const [secrets, setSecrets] = useState<any>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCSVImportModal, setShowCSVImportModal] = useState(false)

  const dispatch = useDispatch()

  useEffect(() => {
    ;(async () => {
      const secrets = []
      for (const secret of Object.values(
        instance?.config?.secrets_config || application?.config?.secrets_config || {},
      )) {
        secrets.push({
          ...secret,
          // value: await decryptServerTransport(secret.value),
          value: secret.value,
        })
      }
      setSecrets(secrets)
    })()
  }, [instance?.config?.secrets_config, application?.config?.secrets_config])

  const [columns, setColumns] = useState<IColumnProps[]>([
    {
      title: 'Name',
      key: 'name',
      dataIndex: 'name',
      render(value, record) {
        return value
      },
      editableRender(value, record) {
        return (
          <Form.Item name="name">
            <Input onChange={() => form.submit()} />
          </Form.Item>
        )
      },
    },
    {
      title: 'Value',
      key: 'value',
      dataIndex: 'value',
      secureField: true,
      render(value, record) {
        return value
      },
      editableRender(value) {
        return (
          <Form.Item name="value">
            <Input onChange={() => form.submit()} />
          </Form.Item>
        )
      },
    },
  ])

  const [form] = useForm()

  const editableTable = useEditableTable({
    form,
    columns,
    setDataSource: setSecrets,
    templateObj: { _id: '', name: 'Secret name', value: 'Secret value' },
  })
  const { editableColumns, onFinish, updatedFields, addNewRecord, displaySecrets, resetUpdatedFields, addCSVRecord } =
    editableTable
  const onSave = async () => {
    // If instance then we will update instance keys, otherwise we will update application config secrets

    const toastId = toast.info(<div>Saving secrets... Please wait!</div>, {
      isLoading: true,
    })

    const route = instance
      ? `/applications/${application?._id}/instances/${instance?._id}/config`
      : `/applications/${application?._id}/config`

    const fields: { [key: string]: any } = {}
    for (const key in updatedFields) {
      switch (key) {
        case 'deleted':
          fields['deleted'] = updatedFields[key]
          break
        case 'newFields':
          for (const [id, field] of Object.entries(updatedFields?.[key] || {})) {
            fields['newFields'] ??= {}
            fields['newFields'][id] = {
              ...field,
              //Temp disabled encryption during transport
              // value: await encryptServerTransport(field.value),
              value: field.value,
            }
          }
          break
        default:
          const data = updatedFields[key]
          if (!data) break
          fields[key] = {
            ...data,
          }
          if (data?.value) {
            //Temp disabled encryption during transport
            // fields[key].value = await encryptServerTransport(data.value)
            fields[key].value = data.value
          }
          break
      }
    }

    const { data } = await apiAxiosToast(toastId).put(route, {
      configModule: constants.CONFIG_MODULES.SECRETS,
      fields,
    })

    if (data?.success) {
      toast.update(toastId, {
        type: 'success',
        render: <div>Saving custom fields... Done!</div>,
        isLoading: false,
        autoClose: 1000,
      })
      resetUpdatedFields()
      dispatch(updateApplication(data?.data?.application))
    }
  }

  const closeImportSecretModal = () => {
    setShowImportModal(false)
  }

  const openImportSecretModal = () => {
    setShowImportModal(true)
  }

  const onImport = (values: any) => {
    const { variables, appVariables } = values

    const variableArr: any[] = []

    for (const variable of variables) {
      const baseVariableInfo = appVariables?.[variable?._id]

      variableArr.push({
        _id: variable?._id,
        name: baseVariableInfo?.name,
        value: baseVariableInfo?.value,
      })
    }
    setSecrets((curr: any) => [...curr, ...variableArr])

    closeImportSecretModal()
  }

  const toggleCSVImportModal = (open: boolean) => {
    setShowCSVImportModal(open)
  }

  const openCSVImportModal = () => {
    toggleCSVImportModal(true)
  }

  const onCSVImportCancel = () => {
    toggleCSVImportModal(false)
  }

  const onCSVImport = (data: CSVData) => {
    addCSVRecord(data)
  }

  return (
    <>
      <section className="application-secrets-config">
        <Card>
          <div className="top-bar d-flex justify-between align-center">
            <div className="left">
              <span className="title">Secrets</span>
            </div>
            <div className="right">
              <div className="right d-flex">
                {instance?._id && (
                  <Button className="m-r-10" onClick={openImportSecretModal}>
                    Import Variables
                  </Button>
                )}
                <Button className="m-r-10" onClick={openCSVImportModal}>
                  Upload Secrets
                </Button>
                <Popconfirm
                  title="Are you sure you want to toggle secret visibility?"
                  onConfirm={() => displaySecrets()}
                >
                  <Button className="m-r-10">Show Secrets</Button>
                </Popconfirm>
                <Button onClick={addNewRecord}>New Secret</Button>
              </div>
            </div>
          </div>
          <Form form={form} onFinish={onFinish}>
            <Table loading={loading} dataSource={secrets} columns={editableColumns} rowKey={'_id'} />
            <Popconfirm title="Are you sure you want to save?" onConfirm={onSave}>
              <Button type="primary">Save</Button>
            </Popconfirm>
          </Form>
        </Card>

        <div className="top-bar-container"></div>
      </section>
      <ImportAppVariables
        visible={showImportModal}
        onCancel={closeImportSecretModal}
        type="secrets"
        variables={secrets}
        application={application}
        onImport={onImport}
      />

      <CSVImportVariables open={showCSVImportModal} onCancel={onCSVImportCancel} onImport={onCSVImport} />
    </>
  )
}

export default SecretsConfig

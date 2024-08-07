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
import { ILinkedIdEnabledDocument } from '../../../interfaces/interfaces'
import ImportAppVariables from './ImportAppVariables'
import CSVImportVariables from './CSVImportVariables.tsx'
import { CSVData } from '../../../helpers/utils.ts'

interface IProps {
  application?: IApplication
  instance?: IInstance
}

export interface IEnvironmentVariable extends ILinkedIdEnabledDocument {
  _id: string
  name: string
  value: string
}

const EnvironmentConfig = ({ application, instance }: IProps) => {
  const [loading, setLoading] = useState(false)
  //   Secrets below will either be the application config secrets or the instance secrets. If instance is defined then we will use instance secrets
  const [environmentVariables, setEnvironmentVariables] = useState<any>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCSVImportModal, setShowCSVImportModal] = useState(false)

  const dispatch = useDispatch()

  useEffect(() => {
    setEnvironmentVariables(
      Object.values(
        instance?._id ? instance?.config?.environment_config : application?.config?.environment_config || {},
      ),
    )
  }, [application?.config?.environment_config])

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
    setDataSource: setEnvironmentVariables,
    templateObj: { _id: '', name: 'Environment name', value: 'Env value' },
  })
  const { editableColumns, onFinish, updatedFields, addNewRecord, resetUpdatedFields, addCSVRecord } = editableTable
  const onSave = async () => {
    // If instance then we will update instance keys, otherwise we will update application config secrets

    const toastId = toast.info(<div>Saving secrets... Please wait!</div>, {
      isLoading: true,
    })

    const route = instance
      ? `/applications/${application?._id}/instances/${instance?._id}/config`
      : `/applications/${application?._id}/config`

    const { data } = await apiAxiosToast(toastId).put(route, {
      configModule: constants.CONFIG_MODULES.ENV_VARS,
      fields: updatedFields,
    })

    if (data?.success) {
      toast.update(toastId, {
        type: 'success',
        render: <div>Saving environment variables... Done!</div>,
        isLoading: false,
        autoClose: 1000,
      })
      resetUpdatedFields()
      dispatch(updateApplication(data?.data?.application))
    }
  }

  const closeImportEnvironmentModal = () => {
    setShowImportModal(false)
  }

  const openImportEnvironmentModal = () => {
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
    setEnvironmentVariables((curr: any) => [...curr, ...variableArr])

    closeImportEnvironmentModal()
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
              <span className="title">Environment Variables</span>
            </div>
            <div className="right">
              <div className="right d-flex">
                {instance?._id && (
                  <Button className="m-r-10" onClick={openImportEnvironmentModal}>
                    Import Variables
                  </Button>
                )}
                <Button className="m-r-10" onClick={openCSVImportModal}>
                  Upload Variables
                </Button>
                <Button onClick={addNewRecord}>New Variable</Button>
              </div>
            </div>
          </div>
          <Form form={form} onFinish={onFinish}>
            <Table loading={loading} dataSource={environmentVariables} columns={editableColumns} rowKey={'_id'} />
            <Popconfirm title="Are you sure you want to save?" onConfirm={onSave}>
              <Button type="primary">Save</Button>
            </Popconfirm>
          </Form>
        </Card>
      </section>

      <ImportAppVariables
        visible={showImportModal}
        onCancel={closeImportEnvironmentModal}
        type="environment_variables"
        variables={environmentVariables}
        application={application}
        onImport={onImport}
      />

      <CSVImportVariables open={showCSVImportModal} onCancel={onCSVImportCancel} onImport={onCSVImport} />
    </>
  )
}

export default EnvironmentConfig

/**
 * Formio 中文国际化配置
 * 从 forms/builder/page.tsx 提取，统一管理 i18n 翻译
 */

export const FORMIO_ZH_CN: Record<string, string> = {
  // 基础字段属性
  'Label': '标签',
  'Label Position': '标签位置',
  'Placeholder': '占位符',
  'Description': '描述',
  'Tooltip': '提示信息',
  'Prefix': '前缀',
  'Suffix': '后缀',
  'Widget': '控件类型',
  'Input Mask': '输入掩码',
  'Custom CSS Class': '自定义CSS类',
  'Tab Index': 'Tab索引',
  'Hidden': '隐藏',
  'Hide Label': '隐藏标签',
  'Show Word Count': '显示字数',
  'Show Char Count': '显示字符数',
  'Hide Input': '隐藏输入',
  'Initial Focus': '初始聚焦',
  'Allow Spellcheck': '允许拼写检查',
  'Disabled': '禁用',
  'Table View': '表格视图',
  'Modal Edit': '模态编辑',
  'Multiple Values': '多值',
  'Persistent': '持久化',
  'Input Format': '输入格式',
  'Protected': '受保护',
  'Database Index': '数据库索引',
  'Text Case': '文本大小写',
  'Redraw On': '重绘触发',
  'Clear Value On Refresh': '刷新时清除值',

  // 计算与默认值
  'Custom Default Value': '自定义默认值',
  'Calculated Value': '计算值',
  'Calculate Value on server': '服务端计算值',
  'Allow Manual Override of Calculated Value': '允许手动覆盖计算值',
  'Server': '服务端',
  'Client': '客户端',
  'None': '无',

  // 校验相关
  'Validate On': '校验触发',
  'Required': '必填',
  'Unique': '唯一',
  'Minimum Length': '最小长度',
  'Maximum Length': '最大长度',
  'Minimum Word Length': '最小单词长度',
  'Maximum Word Length': '最大单词长度',
  'Regular Expression Pattern': '正则表达式',
  'Error Label': '错误标签',
  'Custom Error Message': '自定义错误信息',
  'Custom Validation': '自定义校验',
  'JSONLogic Validation': 'JSONLogic校验',

  // 属性相关
  'Property Name': '属性名',
  'Value': '值',
  'Label Width': '标签宽度',
  'Label Margin': '标签边距',

  // 日期时间
  'Day': '日期',
  'Month': '月',
  'Year': '年',
  'Time': '时间',
  'Short': '短',
  'Medium': '中',
  'Long': '长',

  // 文件上传
  'File': '文件上传',
  'Url': '链接',
  'Data': '数据',
  'File Name': '文件名',
  'File Size': '文件大小',
  'Storage': '存储',
  'Display as Image': '显示为图片',
  'Upload only': '仅上传',
  'Webcam': '摄像头',
  'File Types': '文件类型',

  // 数据源
  'Data Source': '数据源',
  'Values': '值列表',
  'URL': 'URL地址',
  'Data Path': '数据路径',
  'Value Property': '值属性',
  'Item Template': '选项模板',
  'Refresh On': '刷新触发',
  'Search Query Name': '搜索参数名',
  'Authenticate': '认证',
  'Header': '请求头',

  // 布局相关
  'Layout': '布局',
  'HTML Attributes': 'HTML属性',
  'PDF Overlay': 'PDF覆盖',
  'Overlay': '覆盖',
  'Top': '上',
  'Left': '左',
  'Right': '右',
  'Bottom': '下',

  // 组件类型
  'Input': '输入框',
  'Text Area': '多行文本',
  'Number': '数字',
  'Password': '密码',
  'Checkbox': '复选框',
  'Select Boxes': '多选框组',
  'Select': '下拉框',
  'Radio': '单选框',
  'HTML Element': 'HTML元素',
  'Content': '内容',
  'Panel': '面板',
  'Field Set': '字段集',
  'Well': 'Well',
  'Columns': '分栏',
  'Table': '表格',
  'Tabs': '标签页',
  'Date / Time': '日期/时间',
  'Currency': '货币',
  'Survey': '问卷',
  'Signature': '签名',
  'Container': '容器',
  'Data Map': '数据映射',
  'Data Grid': '数据表格',
  'Edit Grid': '编辑表格',
  'Tree': '树形',
  'Button': '按钮',

  // 分类标签
  'Basic': '基础',
  'Advanced': '高级',
  'Premium': '高级',

  // 操作按钮
  'Save': '保存',
  'Cancel': '取消',
  'Remove': '移除',
  'Edit': '编辑',
  'Copy': '复制',
  'Paste': '粘贴',
  'Move': '移动',
  'Settings': '设置',
  'Preview': '预览',

  // 面板标签
  'API': 'API',
  'Conditional': '条件',
  'Logic': '逻辑',
  'Validation': '校验',
  'Display': '显示',
};

/**
 * Formio 配置选项（包含语言设置）
 */
export interface FormioOptions {
  language: string;
  i18n: Record<string, Record<string, string>>;
}

/**
 * 默认 Formio 配置（中文）
 */
export const FORMIO_OPTIONS: FormioOptions = {
  language: 'zh',
  i18n: {
    zh: FORMIO_ZH_CN,
  },
};

/**
 * 获取 Formio 配置
 * @param locale 语言代码，默认 'zh'
 */
export function getFormioOptions(locale: string = 'zh'): FormioOptions {
  // 目前只支持中文，后续可扩展
  return {
    language: locale,
    i18n: {
      [locale]: FORMIO_ZH_CN,
    },
  };
}

export default FORMIO_OPTIONS;

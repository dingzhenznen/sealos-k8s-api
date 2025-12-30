/**
 * K8s 基础服务
 */

import * as k8s from '@kubernetes/client-node';
import { K8sOperationResult } from '../common/types';
import { formatError } from '../common/utils';

export class K8sBaseService {
  protected k8sApi: {
    coreV1Api: k8s.CoreV1Api;
    appsV1Api: k8s.AppsV1Api;
    networkingV1Api: k8s.NetworkingV1Api;
    customObjectsApi: k8s.CustomObjectsApi;
    apiextensionsV1Api: k8s.ApiextensionsV1Api;
    kc: k8s.KubeConfig;
  };

  constructor() {
    const kc = new k8s.KubeConfig();

    // 根据环境加载配置
    if (process.env.KUBECONFIG_PATH) {
      console.log('📁 使用 kubeconfig 文件:', process.env.KUBECONFIG_PATH);
      kc.loadFromFile(process.env.KUBECONFIG_PATH);
    } else if (process.env.KUBECONFIG_CONTENT) {
      console.log('📝 使用 kubeconfig 内容');
      kc.loadFromString(process.env.KUBECONFIG_CONTENT);
    } else if (process.env.APISERVER && process.env.USER_TOKEN) {
      console.log('🔑 使用环境变量配置');
      // 使用环境变量手动配置
      this.configureFromEnv(kc);
    } else {
      console.log('🏢 使用集群内配置');
      kc.loadFromCluster();
    }

    // 输出当前加载的配置信息
    try {
      const currentContext = kc.getCurrentContext();
      const cluster = kc.getCurrentCluster();
      const user = kc.getCurrentUser();

      console.log('✅ KubeConfig 加载成功:');
      console.log('   Context:', currentContext);
      console.log('   Cluster:', cluster?.name);
      console.log('   Server:', cluster?.server);
      console.log('   User:', user?.name);

      // 检查认证方式
      if (user?.token) {
        console.log('   认证方式: Token');
      } else if (user?.certFile && user?.keyFile) {
        console.log('   认证方式: 客户端证书');
        console.log('   证书文件:', user.certFile);
        console.log('   密钥文件:', user.keyFile);
      } else if (user?.certData && user?.keyData) {
        console.log('   认证方式: 客户端证书 (Base64)');
      } else {
        console.warn('⚠️  警告: 未检测到有效的认证信息!');
      }
    } catch (error) {
      console.error('❌ 读取 kubeconfig 信息失败:', error);
    }

    this.k8sApi = {
      coreV1Api: kc.makeApiClient(k8s.CoreV1Api),
      appsV1Api: kc.makeApiClient(k8s.AppsV1Api),
      networkingV1Api: kc.makeApiClient(k8s.NetworkingV1Api),
      customObjectsApi: kc.makeApiClient(k8s.CustomObjectsApi),
      apiextensionsV1Api: kc.makeApiClient(k8s.ApiextensionsV1Api),
      kc
    };

    this.logConnectionInfo();
  }

  /**
   * 从环境变量配置 KubeConfig
   */
  private configureFromEnv(kc: k8s.KubeConfig): void {
    const cluster = {
      name: 'default-cluster',
      server: process.env.APISERVER!,
      skipTLSVerify: true // 在开发环境中跳过 TLS 验证
    };

    const user = {
      name: process.env.USER_NAME || 'default-user',
      token: process.env.USER_TOKEN!
    };

    const context = {
      name: 'default-context',
      cluster: cluster.name,
      user: user.name,
      namespace: process.env.NAMESPACE || 'default'
    };

    kc.loadFromOptions({
      clusters: [cluster],
      users: [user],
      contexts: [context],
      currentContext: context.name
    });
  }

  /**
   * 记录连接信息
   */
  private logConnectionInfo(): void {
    try {
      const currentContext = this.k8sApi.kc.getCurrentContext();
      const cluster = this.k8sApi.kc.getCurrentCluster();
      const user = this.k8sApi.kc.getCurrentUser();

      // 优先使用环境变量中的 API 服务器地址
      const apiServer = process.env.APISERVER || cluster?.server || 'kubernetes.default.svc.cluster.local:443';

    } catch (error) {
      // 即使获取连接信息失败，也显示基本的环境变量信息
    }
  }

  /**
   * 验证 K8s 连接
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const namespace = process.env.NAMESPACE || 'default';
      await this.k8sApi.coreV1Api.readNamespace({ name: namespace });
      return true;
    } catch (error) {
      console.error('Kubernetes API 连接验证失败:', formatError(error));
      return false;
    }
  }

  /**
   * 执行 kubectl 命令
   */
  async executeKubectlCommand(command: string, input?: string): Promise<K8sOperationResult> {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const namespace = process.env.NAMESPACE;
      const fullCommand = namespace ? `${command} -n ${namespace}` : command;

      // 设置环境变量，包含认证信息
      const env = {
        ...process.env
      };

      // 如果有认证信息，添加 kubectl 参数
      const args = fullCommand.split(' ');
      if (process.env.USER_TOKEN && process.env.APISERVER) {
        args.push('--server', process.env.APISERVER);
        args.push('--token', process.env.USER_TOKEN);
        args.push('--insecure-skip-tls-verify');
      }

      const kubectl = spawn('kubectl', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      let stdout = '';
      let stderr = '';

      kubectl.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      kubectl.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // 如果有输入数据，写入到 stdin
      if (input) {
        kubectl.stdin?.write(input);
        kubectl.stdin?.end();
      }

      kubectl.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          });
        } else {
          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            error: `kubectl 命令执行失败，退出码: ${code}`
          });
        }
      });

      kubectl.on('error', (error) => {
        resolve({
          success: false,
          error: `kubectl 命令执行错误: ${error.message}`
        });
      });
    });
  }



  /**
   * 检查 CRD 是否存在
   */
  async checkCRDExists(group: string, version: string, kind: string): Promise<boolean> {
    try {
      // 检查 API 资源是否可用
      const apiResources = await this.k8sApi.apiextensionsV1Api.listCustomResourceDefinition();

      const crdName = `${kind.toLowerCase()}s.${group}`;
      const crdExists = apiResources.items.some(crd =>
        crd.metadata?.name === crdName
      );

      return crdExists;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * 检查 Devbox CRD 是否安装
   */
  async checkDevboxCRD(): Promise<{ exists: boolean; message: string }> {
    const exists = await this.checkCRDExists('devbox.sealos.io', 'v1alpha1', 'devbox');

    if (!exists) {
      return {
        exists: false,
        message: 'Devbox CRD 未安装。请先安装 Sealos Devbox 组件。'
      };
    }

    return {
      exists: true,
      message: 'Devbox CRD 已安装'
    };
  }

  /**
   * 处理 K8s API 错误
   */
  protected handleK8sError(error: any): Error {
    const message = formatError(error);
    const enhancedError = new Error(message);

    // 保留原始错误的状态码
    if (error?.statusCode) {
      (enhancedError as any).statusCode = error.statusCode;
    }

    return enhancedError;
  }
}

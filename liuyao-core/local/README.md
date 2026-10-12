# 用本地 Qwen（unsloth）跑看卦

需要一台有 NVIDIA 显卡的机器（你自己的电脑或服务器），不是这个云端会话。

## 第一步：启动模型服务

```
pip install unsloth
export QWEN_MODEL=你的Qwen模型路径或Hugging Face名字
python3 local/serve_qwen_unsloth.py --port 8000
```

看到 `ready: http://127.0.0.1:8000/v1` 就说明成功了。这个服务对外提供和 OpenRouter 一样的接口。

## 第二步：让看卦用它

```
export LOCAL_LLM_BASE_URL=http://127.0.0.1:8000/v1
export LOCAL_MODEL=$QWEN_MODEL
npm run ask -- --local --question "北京物流设计大赛能打到哪个地步（已过校赛）"
```

ComfyUI 里把配置节点的 `mode` 选成 `local` 即可，前提是 ComfyUI 的环境里也设了 `LOCAL_LLM_BASE_URL`。

## 说明

- 模型的思考模式关闭了，只返回 JSON 和正文。
- 每次只处理一个请求，显卡一次只跑一个。
- 模型名不写死在代码里，全部从环境变量读。
- 这一段没有在真实显卡上跑过。测试只检查了接口的形状和看卦一侧的读写。

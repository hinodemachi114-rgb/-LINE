# LINE配信WEBアプリ v2

## 概要
LINE Messaging APIを使用した、メッセージ配信・管理用WEBアプリの最新版です。
既存のシステムをVite + React + Expressのモダンな環境で再構築しています。

## ディレクトリ構成
- `/frontend`: Vite + React (TypeScript)
  - `npm run dev` で開発サーバ起動
- `/backend`: Node.js + Express
  - `npm run dev` でnodemonによる開発サーバ起動

## セットアップ
1. `backend/.env` を `.env.example` を参考に作成し、LINEの認証情報を設定してください。
2. FrontendとBackendそれぞれのディレクトリで `npm install` を実行（完了済み）。
3. それぞれのディレクトリで `npm run dev` を実行して開発を開始してください。

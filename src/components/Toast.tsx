export default function Toast({ message }: { message: string }) {
  return <div className="m-toast" role="status">{message}</div>
}

namespace Nexa.V6.Sdk;

public sealed class NexaSdkException : Exception
{
    public string Code { get; }
    public string? ServerCode { get; }
    public object? Details { get; }

    public NexaSdkException(string code, object? details = null, string? serverCode = null)
        : base(code)
    {
        Code = code;
        Details = details;
        ServerCode = serverCode;
    }
}

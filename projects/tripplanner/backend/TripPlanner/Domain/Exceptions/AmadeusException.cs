namespace Domain.Exceptions;

public sealed class AmadeusException : Exception
{
    public AmadeusException(string message) : base(message) { }
}

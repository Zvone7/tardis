
namespace Domain.Exceptions;
public sealed class LocationIqException : Exception
{
    public LocationIqException(string message) : base(message) { }
}
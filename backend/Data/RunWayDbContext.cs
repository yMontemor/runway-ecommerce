using Microsoft.EntityFrameworkCore;

namespace RunWay.Api.Data;

public class RunWayDbContext : DbContext
{
    public RunWayDbContext(DbContextOptions<RunWayDbContext> options)
        : base(options)
    {
    }
}
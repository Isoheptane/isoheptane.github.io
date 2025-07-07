#include <blkid/blkid.h>

#include <stdio.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>

static void pretty_print_dev(blkid_dev dev)
{
	blkid_tag_iterate	iter;
	const char		*type, *value, *devname;
	const char		*uuid = "", *fs_type = "", *label = "";
	int			len, mount_flags;
	char			mtpt[80];
	int			retval;

	devname = blkid_dev_devname(dev);
	if (access(devname, F_OK))
		return;

	/* Get the uuid, label, type */
    printf("Device Name: %s\n", devname);
	iter = blkid_tag_iterate_begin(dev);
	while (blkid_tag_next(iter, &type, &value) == 0) {
        printf(" > %s: %s\n", type, value);
	}
	blkid_tag_iterate_end(iter);
}

int main(int argc, char** argv) {

    if (argc < 2) {
        printf("Device name not specified.\n");
        return -1;
    }

    blkid_probe pr = blkid_new_probe();

    struct stat sb;
    const char* devname = argv[1];
    
    if (stat(devname, &sb) != 0) {
		printf("Stat failed.\n");
        return -1;
    } else if (S_ISBLK(sb.st_mode)) {
		printf("ISBLK checked\n");
    } else if (S_ISREG(sb.st_mode)) {
		printf("ISREG checked\n");
	} else if (S_ISCHR(sb.st_mode)) {
        printf("ISCHR checked\n");
    }

    size_t size = blkid_probe_get_size(pr);
    printf("Size is %zd\n", size);

    if (blkid_probe_is_wholedisk(pr)) {
        printf("Is whole disk.\n");
    }

    int fd = open(devname, O_RDONLY|O_NONBLOCK);
    if (fd < 0) {
        printf("Failed to open device.\n");
        return -1;
	}

    blkid_probe_set_device(pr, fd, 0, 0);

    blkid_probe_enable_topology(pr, 1);
	blkid_probe_enable_superblocks(pr, 1);
	blkid_probe_enable_partitions(pr, 1);
    blkid_probe_set_partitions_flags(pr, BLKID_PARTS_ENTRY_DETAILS);

	int rc = blkid_do_safeprobe(pr);
    printf("RC = %d\n", rc);

    int nvals = 0;
    if (!rc)
		nvals = blkid_probe_numof_values(pr);
    printf("%d values fetched.\n", nvals);

    for (int i = 0; i < nvals; i++) {
        const char* name;
        const char* data;
        size_t len;
        if (blkid_probe_get_value(pr, i, &name, &data, &len))
            continue;
        len = strnlen(data, len);
        printf(" > %s: %s\n", name, data);
    }

    return 0;

    blkid_cache cache;
	blkid_get_cache(&cache, NULL);
    blkid_gc_cache(cache);

    
    // blkid_probe pr;
    // blkid_probe_all(cache);

    blkid_dev_iterate	iter;
    blkid_dev		dev;

    iter = blkid_dev_iterate_begin(cache);
	blkid_dev_set_search(iter, NULL, NULL);
	while (blkid_dev_next(iter, &dev) == 0) {
		dev = blkid_verify(cache, dev);
		if (!dev)
			continue;
		pretty_print_dev(dev);
		// err = 0;
	}
	blkid_dev_iterate_end(iter);
    
    return 0;
}
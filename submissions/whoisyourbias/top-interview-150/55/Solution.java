class Solution {
    public boolean canJump(int[] nums) {

		int max_jumpable = 0;

		for (int i = 0; i < nums.length-1
        ; i++) {
            if (i > max_jumpable)
                continue;


			if (max_jumpable < nums[i] + i) {
				max_jumpable = nums[i] + i;
			}
		}

		if (max_jumpable >= nums.length - 1) {
			return true;
		}
		return false;
    }
}


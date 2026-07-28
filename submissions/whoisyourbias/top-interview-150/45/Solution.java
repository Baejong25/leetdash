class Solution {
	public int jump(int[] nums) {
        if (nums.length == 1) return 0;
        if (nums.length == 2) return 1;

		int jump_c = 0;
		int cur_max = nums[0];
        int cur_idx = 0;

        while (true) {
            if (cur_idx >= nums.length - 1) {break;}

            // 현재 위치 기준, 가장 멀리 갈 수 있는 곳 찍기
            int max = 0;
            for (int i = cur_idx + 1; i <= cur_max; i++) {
                if (i == nums.length - 1) {
                    return ++jump_c;
                }

                if (nums[i] + i > max) {
                    max = nums[i] +i;
                }
            }

            jump_c++;
            cur_idx = cur_max;
            cur_max = max;
        }

		return jump_c;
    }
}


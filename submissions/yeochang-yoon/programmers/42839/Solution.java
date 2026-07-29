import java.util.*;

class Solution {
    public int solution(String numbers) {

        int n = numbers.length();

        int[] arr = new int[n];

        for(int i = 0; i < n; i++){
            arr[i] = numbers.charAt(i) - '0';
        }

        List<String> list = new ArrayList<>();
        List<Integer> nums = new ArrayList<>();

        func(arr, list, nums);

        List<Integer> result = new ArrayList<>();

        for(int i = 0; i < list.size(); i++){
            result.add(Integer.parseInt(list.get(i)));
        }

        List<Integer> dap = new ArrayList<>(new TreeSet<>(result));

        int answer = 0;

        for(int i = 0; i < dap.size(); i++){
            if(dap.get(i) == 1 || dap.get(i) == 0){
                continue;
            }
            boolean flag = true;
            for(int j = 2; j < dap.get(i); j++){
                if(dap.get(i) % j == 0){
                    flag = false;
                    break;
                }
            }
            if(flag){
                answer++;
            }
        }


        return answer;
    }

    private void func(int[] arr, List<String> list, List<Integer> nums){
        for(int i = 0; i < arr.length; i++){

            if(nums.contains(i)){
                continue;
            }
            nums.add(i);

            String str = "";
            for(int j = 0; j < nums.size(); j++){
                str += arr[nums.get(j)];
            }

            list.add(str);

            func(arr, list, nums);

            nums.remove(nums.size() - 1);

        }
    }
}